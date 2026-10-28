import OpenAI from "openai";
import type { Env } from "../../config/env.js";
import { ProviderError } from "../../utils/errors.js";
import { withRetry } from "../../utils/retry.js";
import type { EmbeddingProvider } from "./embedding-provider.interface.js";

export function createOpenAiEmbeddingProvider(env: Env): EmbeddingProvider {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ProviderError("OPENAI_API_KEY is required for OpenAI embeddings");
  }
  const client = new OpenAI({ apiKey, timeout: env.REQUEST_TIMEOUT_MS });
  const modelId = env.EMBEDDING_MODEL;
  const dimensions = env.EMBEDDING_DIMENSIONS;

  return {
    providerId: "openai",
    modelId,
    dimensions,
    async embedTexts(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      return withRetry(
        async () => {
          const response = await client.embeddings.create({
            model: modelId,
            input: texts,
            dimensions,
          });
          return response.data
            .sort((a, b) => a.index - b.index)
            .map((d) => d.embedding);
        },
        {
          maxAttempts: 3,
          baseDelayMs: 500,
          retryable: (err) => {
            const status = (err as { status?: number }).status;
            return status === 429 || status === 503;
          },
        },
      );
    },
  };
}
