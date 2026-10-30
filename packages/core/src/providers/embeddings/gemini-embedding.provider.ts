import { GoogleGenAI } from "@google/genai";
import type { Env } from "../../config/env.js";
import { ProviderError } from "../../utils/errors.js";
import { withRetry } from "../../utils/retry.js";
import type { EmbeddingProvider } from "./embedding-provider.interface.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err);
  const status = (err as { status?: number }).status;
  return (
    status === 429 ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota")
  );
}

function toProviderError(err: unknown, modelId: string): ProviderError {
  if (err instanceof ProviderError) return err;
  const msg = String(err);
  if (msg.includes("not found") || msg.includes("NOT_FOUND")) {
    return new ProviderError(
      `Embedding model "${modelId}" is not available for Gemini embedContent. Set EMBEDDING_MODEL to gemini-embedding-001 (768 dimensions).`,
    );
  }
  if (isRateLimitError(err)) {
    return new ProviderError(
      "Gemini embedding rate limit exceeded (free tier: about 100 embed requests per minute). " +
        "Wait 60 seconds and try again, reduce CHUNK_SIZE, or use a billed API key.",
    );
  }
  return new ProviderError("Gemini embedding request failed");
}

export function createGeminiEmbeddingProvider(env: Env): EmbeddingProvider {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderError("GEMINI_API_KEY is required for Gemini embeddings");
  }
  const client = new GoogleGenAI({ apiKey });
  const modelId = env.EMBEDDING_MODEL;
  const dimensions = env.EMBEDDING_DIMENSIONS;
  const concurrency = Math.min(Math.max(env.EMBED_CONCURRENCY, 1), 4);
  const minIntervalMs = env.EMBED_MIN_INTERVAL_MS;

  async function embedOne(text: string): Promise<number[]> {
    try {
      return await withRetry(
        async () => {
          const result = await client.models.embedContent({
            model: modelId,
            contents: text,
            config: { outputDimensionality: dimensions },
          });
          const values = result.embeddings?.[0]?.values;
          if (!values || values.length === 0) {
            throw new ProviderError("Gemini returned empty embedding");
          }
          return values;
        },
        {
          maxAttempts: 5,
          baseDelayMs: 12_000,
          retryable: isRateLimitError,
        },
      );
    } catch (err) {
      throw toProviderError(err, modelId);
    }
  }

  return {
    providerId: "gemini",
    modelId,
    dimensions,
    async embedTexts(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const vectors: number[][] = [];

      // Free-tier Gemini allows ~100 embedContent calls/minute; throttle to avoid 429 on large pages.
      for (let i = 0; i < texts.length; i += concurrency) {
        const slice = texts.slice(i, i + concurrency);
        const batch = await Promise.all(slice.map((text) => embedOne(text)));
        vectors.push(...batch);
        if (minIntervalMs > 0 && i + concurrency < texts.length) {
          await sleep(minIntervalMs);
        }
      }
      return vectors;
    },
  };
}
