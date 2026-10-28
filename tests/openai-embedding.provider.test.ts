import { describe, expect, it, vi } from "vitest";
import { createOpenAiEmbeddingProvider, loadEnv, resetEnvCache } from "@rag-scrapper/core";
import { withTestEnv } from "./helpers/test-env.js";

vi.mock("openai", () => {
  class MockOpenAI {
    embeddings = {
      create: vi.fn().mockResolvedValue({
        data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }],
      }),
    };
  }
  return { default: MockOpenAI };
});

describe("OpenAI embedding provider", () => {
  it("returns vectors from mocked SDK", async () => {
    resetEnvCache();
    const env = loadEnv(
      withTestEnv({
        EMBEDDING_PROVIDER: "openai",
        EMBEDDING_MODEL: "text-embedding-3-small",
        EMBEDDING_DIMENSIONS: "3",
        OPENAI_API_KEY: "sk-test",
      }),
    );
    const provider = createOpenAiEmbeddingProvider(env);
    const vectors = await provider.embedTexts(["hello"]);
    expect(vectors).toHaveLength(1);
    expect(vectors[0]).toEqual([0.1, 0.2, 0.3]);
  });
});
