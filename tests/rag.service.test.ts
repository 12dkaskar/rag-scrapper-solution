import { describe, expect, it, vi } from "vitest";
import {
  loadEnv,
  resetEnvCache,
  type GenerationProvider,
  type RetrievalService,
  RagService,
} from "@rag-scrapper/core";
import { withTestEnv } from "./helpers/test-env.js";

describe("RagService", () => {
  it("returns no-context message without calling generation", async () => {
    resetEnvCache();
    const env = loadEnv(withTestEnv());
    const retrieval = {
      retrieve: vi.fn().mockResolvedValue({ chunks: [], sources: [] }),
    } as unknown as RetrievalService;
    const generation: GenerationProvider = {
      providerId: "gemini",
      modelId: "gemini-2.0-flash",
      generateAnswer: vi.fn(),
    };
    const rag = new RagService(env, retrieval, generation);
    const result = await rag.chat("What is RAG?");
    expect(result.sources).toHaveLength(0);
    expect(result.answer).toContain("do not contain enough information");
    expect(generation.generateAnswer).not.toHaveBeenCalled();
  });

  it("calls generation when chunks are retrieved", async () => {
    resetEnvCache();
    const env = loadEnv(withTestEnv());
    const retrieval = {
      retrieve: vi.fn().mockResolvedValue({
        chunks: [
          {
            documentId: "doc-1",
            content: "RAG combines retrieval and generation.",
            metadata: {
              sourceType: "web",
              sourceUrl: "https://example.com",
              title: "Example",
              chunkIndex: 0,
              pageNumber: null,
            },
            score: 0.9,
          },
        ],
        sources: [],
      }),
    } as unknown as RetrievalService;
    const generation: GenerationProvider = {
      providerId: "gemini",
      modelId: "gemini-2.0-flash",
      generateAnswer: vi.fn().mockResolvedValue({ answer: "RAG retrieves then generates." }),
    };
    const rag = new RagService(env, retrieval, generation);
    const result = await rag.chat("What is RAG?");
    expect(generation.generateAnswer).toHaveBeenCalled();
    expect(result.answer).toContain("RAG retrieves");
  });
});
