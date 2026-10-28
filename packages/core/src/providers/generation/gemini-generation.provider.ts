import { GoogleGenAI } from "@google/genai";
import type { Env } from "../../config/env.js";
import { ProviderError } from "../../utils/errors.js";
import type { ContextBlock, GenerationProvider, GenerationResult } from "./generation-provider.interface.js";
import { GROUNDED_SYSTEM_INSTRUCTIONS, buildUserPrompt } from "./prompts.js";

export function createGeminiGenerationProvider(env: Env): GenerationProvider {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderError("GEMINI_API_KEY is required for Gemini generation");
  }
  const client = new GoogleGenAI({ apiKey });
  const modelId = env.GENERATION_MODEL;

  return {
    providerId: "gemini",
    modelId,
    async generateAnswer(question: string, contextBlocks: ContextBlock[]): Promise<GenerationResult> {
      try {
        const response = await client.models.generateContent({
          model: modelId,
          contents: buildUserPrompt(question, contextBlocks),
          config: {
            systemInstruction: GROUNDED_SYSTEM_INSTRUCTIONS,
            temperature: 0.2,
          },
        });
        const answer = response.text?.trim();
        if (!answer) {
          throw new ProviderError("Gemini returned empty completion");
        }
        return { answer };
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        const msg = String(err);
        if (msg.includes("high demand") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
          throw new ProviderError(
            "Gemini is temporarily overloaded. Retry in a few seconds or set GENERATION_MODEL to gemini-3.5-flash-lite.",
            503,
          );
        }
        if (msg.includes("no longer available") || msg.includes("NOT_FOUND")) {
          throw new ProviderError(
            `Generation model "${modelId}" is not available for your API key. Set GENERATION_MODEL to gemini-3.8-flash in .env.`,
          );
        }
        throw new ProviderError("Gemini generation request failed");
      }
    },
  };
}
