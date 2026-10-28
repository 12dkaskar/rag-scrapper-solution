import type { Env } from "../../config/env.js";
import { ValidationError } from "../../utils/errors.js";
import type { EmbeddingProvider } from "./embedding-provider.interface.js";
import { createGeminiEmbeddingProvider } from "./gemini-embedding.provider.js";
import { createOpenAiEmbeddingProvider } from "./openai-embedding.provider.js";

export function createEmbeddingProvider(env: Env): EmbeddingProvider {
  // Embedding and generation providers are independent; vectors are not interchangeable across models.
  switch (env.EMBEDDING_PROVIDER) {
    case "openai":
      return createOpenAiEmbeddingProvider(env);
    case "gemini":
      return createGeminiEmbeddingProvider(env);
    default:
      throw new ValidationError(`Unknown EMBEDDING_PROVIDER: ${env.EMBEDDING_PROVIDER}`);
  }
}

export type { EmbeddingProvider } from "./embedding-provider.interface.js";
