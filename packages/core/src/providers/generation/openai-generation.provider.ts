import OpenAI from "openai";
import type { Env } from "../../config/env.js";
import { ProviderError } from "../../utils/errors.js";
import type { ContextBlock, GenerationProvider, GenerationResult } from "./generation-provider.interface.js";
import { GROUNDED_SYSTEM_INSTRUCTIONS, buildUserPrompt } from "./prompts.js";

export function createOpenAiGenerationProvider(env: Env): GenerationProvider {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ProviderError("OPENAI_API_KEY is required for OpenAI generation");
  }
  const client = new OpenAI({ apiKey, timeout: env.REQUEST_TIMEOUT_MS });
  const modelId = env.GENERATION_MODEL;

  return {
    providerId: "openai",
    modelId,
    async generateAnswer(question: string, contextBlocks: ContextBlock[]): Promise<GenerationResult> {
      const response = await client.chat.completions.create({
        model: modelId,
        messages: [
          { role: "system", content: GROUNDED_SYSTEM_INSTRUCTIONS },
          { role: "user", content: buildUserPrompt(question, contextBlocks) },
        ],
        temperature: 0.2,
      });
      const answer = response.choices[0]?.message?.content?.trim();
      if (!answer) {
        throw new ProviderError("OpenAI returned empty completion");
      }
      return {
        answer,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
        },
      };
    },
  };
}
