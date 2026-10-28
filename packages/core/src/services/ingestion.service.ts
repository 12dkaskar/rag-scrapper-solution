import { randomUUID } from "crypto";
import type { Env } from "../config/env.js";
import { ChunksRepository } from "../db/repositories/chunks.repository.js";
import { DocumentsRepository } from "../db/repositories/documents.repository.js";
import { loadPdfFromBuffer } from "../loaders/pdf.loader.js";
import { loadWebPage } from "../loaders/web.loader.js";
import type { EmbeddingProvider } from "../providers/embeddings/embedding-provider.interface.js";
import type { RagChunkRecord, SourceType } from "../types/domain.js";
import { redactErrorMessage, ValidationError } from "../utils/errors.js";
import { sha256Hex } from "../utils/text.js";
import { ChunkingService } from "./chunking.service.js";

const EMBED_BATCH_SIZE = 16;

export class IngestionService {
  constructor(
    private readonly env: Env,
    private readonly documents: DocumentsRepository,
    private readonly chunks: ChunksRepository,
    private readonly embedding: EmbeddingProvider,
    private readonly chunking: ChunkingService,
  ) {}

  async ingestUrl(url: string): Promise<{ documentId: string; status: string }> {
    const loaded = await loadWebPage(url, this.env);
    const contentHash = sha256Hex(`web:${loaded.canonicalUrl}`);
    const existing = await this.documents.findByContentHash(contentHash);
    if (existing?.status === "completed") {
      return { documentId: existing.documentId, status: existing.status };
    }

    const documentId = randomUUID();
    await this.documents.create({
      documentId,
      sourceType: "web",
      sourceUrl: loaded.canonicalUrl,
      title: loaded.title,
      contentHash,
    });

    return this.processDocument(documentId, "web", loaded.canonicalUrl, loaded.title, async () => {
      return this.chunking.chunkPlainText(
        loaded.text,
        "web",
        loaded.canonicalUrl,
        loaded.title,
      );
    });
  }

  async ingestPdf(buffer: Buffer, filename: string): Promise<{ documentId: string; status: string }> {
    const loaded = await loadPdfFromBuffer(buffer, filename, this.env.MAX_PDF_SIZE_MB);
    const contentHash = sha256Hex(buffer);
    const existing = await this.documents.findByContentHash(contentHash);
    if (existing?.status === "completed") {
      return { documentId: existing.documentId, status: existing.status };
    }

    const documentId = randomUUID();
    await this.documents.create({
      documentId,
      sourceType: "pdf",
      sourceUrl: null,
      title: loaded.title,
      contentHash,
    });

    return this.processDocument(documentId, "pdf", null, loaded.title, async () => {
      const segments = loaded.pages.map((p) => ({
        text: p.text,
        pageNumber: p.pageNumber,
      }));
      return this.chunking.chunkSegments(segments, {
        sourceType: "pdf",
        sourceUrl: null,
        title: loaded.title,
      });
    });
  }

  async getStatus(documentId: string) {
    const doc = await this.documents.getByDocumentId(documentId);
    return {
      documentId: doc.documentId,
      status: doc.status,
      chunkCount: doc.chunkCount,
      title: doc.title,
      sourceType: doc.sourceType,
      sourceUrl: doc.sourceUrl,
      errorSummary: doc.errorSummary,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private async processDocument(
    documentId: string,
    _sourceType: SourceType,
    _sourceUrl: string | null,
    title: string,
    produceChunks: () => Promise<
      { content: string; metadata: RagChunkRecord["metadata"] }[]
    >,
  ): Promise<{ documentId: string; status: string }> {
    await this.documents.updateStatus(documentId, "processing");
    try {
      const chunkOutputs = await produceChunks();
      if (chunkOutputs.length === 0) {
        throw new ValidationError("No chunks produced from source");
      }

      const texts = chunkOutputs.map((c) => c.content);
      const allEmbeddings: number[][] = [];
      for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
        const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
        const vectors = await this.embedding.embedTexts(batch);
        allEmbeddings.push(...vectors);
      }

      if (allEmbeddings.length !== chunkOutputs.length) {
        throw new ValidationError("Embedding count does not match chunk count");
      }

      const now = new Date();
      const records: RagChunkRecord[] = chunkOutputs.map((c, idx) => ({
        documentId,
        content: c.content,
        embedding: allEmbeddings[idx],
        metadata: { ...c.metadata, title: title || c.metadata.title },
        embeddingModel: this.embedding.modelId,
        embeddingProvider: this.embedding.providerId,
        embeddingDimensions: this.embedding.dimensions,
        createdAt: now,
      }));

      await this.chunks.insertMany(records);
      await this.documents.updateStatus(documentId, "completed", {
        chunkCount: records.length,
        title,
      });
      return { documentId, status: "completed" };
    } catch (err) {
      // Compensation: remove partial chunks so a failed ingest is never left half-indexed.
      await this.chunks.deleteByDocumentId(documentId);
      const summary = redactErrorMessage(err);
      await this.documents.updateStatus(documentId, "failed", {
        errorSummary: summary,
        chunkCount: 0,
      });
      throw err;
    }
  }
}
