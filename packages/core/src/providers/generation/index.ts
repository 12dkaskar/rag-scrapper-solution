import type { Env } from "../../config/env.js";
import { ValidationError } from "../../utils/errors.js";
import type { GenerationProvider } from "./generation-provider.interface.js";
import { createGeminiGenerationProvider } from "./gemini-generation.provider.js";
import { createOpenAiGenerationProvider } from "./openai-generation.provider.js";

export function createGenerationProvider(env: Env): GenerationProvider {
  switch (env.GENERATION_PROVIDER) {
    case "openai":
      return createOpenAiGenerationProvider(env);
    case "gemini":
      return createGeminiGenerationProvider(env);
    default:
      throw new ValidationError(`Unknown GENERATION_PROVIDER: ${env.GENERATION_PROVIDER}`);
  }
}

export type { GenerationProvider, ContextBlock, GenerationResult } from "./generation-provider.interface.js";
