import { GoogleGenAI } from "@google/genai";
import type { Env } from "../../config/env.js";
import { ProviderError } from "../../utils/errors.js";
import { withRetry } from "../../utils/retry.js";
import type { EmbeddingProvider } from "./embedding-provider.interface.js";

const EMBED_CONCURRENCY = 8;

export function createGeminiEmbeddingProvider(env: Env): EmbeddingProvider {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderError("GEMINI_API_KEY is required for Gemini embeddings");
  }
  const client = new GoogleGenAI({ apiKey });
  const modelId = env.EMBEDDING_MODEL;
  const dimensions = env.EMBEDDING_DIMENSIONS;

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
          maxAttempts: 3,
          baseDelayMs: 500,
          retryable: (err) => {
            const msg = String(err);
            return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
          },
        },
      );
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const msg = String(err);
      if (msg.includes("not found") || msg.includes("NOT_FOUND")) {
        throw new ProviderError(
          `Embedding model "${modelId}" is not available for Gemini embedContent. Set EMBEDDING_MODEL to gemini-embedding-001 (768 dimensions).`,
        );
      }
      throw new ProviderError("Gemini embedding request failed");
    }
  }

  return {
    providerId: "gemini",
    modelId,
    dimensions,
    async embedTexts(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += EMBED_CONCURRENCY) {
        const slice = texts.slice(i, i + EMBED_CONCURRENCY);
        const batch = await Promise.all(slice.map((text) => embedOne(text)));
        vectors.push(...batch);
      }
      return vectors;
    },
  };
}
