import { describe, expect, it } from "vitest";
import { ChunkingService, loadEnv, resetEnvCache } from "@rag-scrapper/core";
import { withTestEnv } from "./helpers/test-env.js";

describe("ChunkingService", () => {
  it("preserves metadata across chunks", async () => {
    resetEnvCache();
    const env = loadEnv(withTestEnv({ CHUNK_SIZE: "50", CHUNK_OVERLAP: "10" }));
    const chunking = new ChunkingService(env);
    const text = "word ".repeat(80).trim();
    const chunks = await chunking.chunkPlainText(
      text,
      "web",
      "https://example.com",
      "Example",
      null,
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.sourceUrl).toBe("https://example.com");
    expect(chunks[0].metadata.title).toBe("Example");
    expect(chunks[0].metadata.chunkIndex).toBe(0);
    expect(chunks[1].metadata.chunkIndex).toBe(1);
  });
});
