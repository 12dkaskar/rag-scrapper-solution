import { describe, expect, it, vi } from "vitest";
import { DocumentsController } from "../apps/api/src/documents/documents.controller.js";
import { loadEnv, resetEnvCache, type RagContext } from "@rag-scrapper/core";
import { withTestEnv } from "./helpers/test-env.js";

describe("DELETE /api/documents/:documentId", () => {
  it("deletes document and associated chunks", async () => {
    resetEnvCache();
    const env = loadEnv(withTestEnv());
    const deleteChunks = vi.fn().mockResolvedValue(3);
    const deleteDoc = vi.fn().mockResolvedValue(true);
    const ctx = {
      env,
      chunks: { deleteByDocumentId: deleteChunks },
      documents: { delete: deleteDoc },
      ingestion: {},
      rag: {},
    } as unknown as RagContext;
    const controller = new DocumentsController(ctx);
    const res = await controller.remove("doc-123");
    expect(deleteChunks).toHaveBeenCalledWith("doc-123");
    expect(deleteDoc).toHaveBeenCalledWith("doc-123");
    expect(res.deletedChunks).toBe(3);
  });
});
