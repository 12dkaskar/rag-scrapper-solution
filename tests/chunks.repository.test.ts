import { describe, expect, it, vi } from "vitest";
import { ChunksRepository, loadEnv, resetEnvCache, ValidationError } from "@rag-scrapper/core";
import { withTestEnv } from "./helpers/test-env.js";

vi.mock("../packages/core/src/db/elastic.client.js", () => ({
  getElasticsearchClient: () => ({
    bulk: vi.fn().mockResolvedValue({ errors: false }),
  }),
}));

describe("ChunksRepository.validateEmbedding", () => {
  it("rejects wrong vector dimensions", async () => {
    resetEnvCache();
    const env = loadEnv(withTestEnv({ EMBEDDING_DIMENSIONS: "768" }));
    const repo = new ChunksRepository(env);
    await expect(
      repo.insertMany([
        {
          documentId: "d1",
          content: "x",
          embedding: [0.1, 0.2],
          metadata: {
            sourceType: "web",
            sourceUrl: null,
            title: "t",
            chunkIndex: 0,
            pageNumber: null,
          },
          embeddingModel: "gemini-embedding-001",
          embeddingProvider: "gemini",
          embeddingDimensions: 768,
          createdAt: new Date(),
        },
      ]),
    ).rejects.toThrow(ValidationError);
  });
});
