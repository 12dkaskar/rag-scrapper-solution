import type { Env } from "../config/env.js";
import { ChunksRepository } from "../db/repositories/chunks.repository.js";
import type { EmbeddingProvider } from "../providers/embeddings/embedding-provider.interface.js";
import type { RetrievedChunk, SourceReference } from "../types/domain.js";
import { excerpt } from "../utils/text.js";

export class RetrievalService {
  constructor(
    private readonly env: Env,
    private readonly chunks: ChunksRepository,
    private readonly embedding: EmbeddingProvider,
  ) {}

  async retrieve(
    question: string,
    topK: number,
    documentIds?: string[],
  ): Promise<{ chunks: RetrievedChunk[]; sources: SourceReference[] }> {
    const [queryVector] = await this.embedding.embedTexts([question]);
    const k = topK || this.env.RAG_TOP_K;
    const chunks = await this.chunks.vectorSearch(queryVector, k, documentIds);
    const sources: SourceReference[] = chunks.map((c) => ({
      documentId: c.documentId,
      title: c.metadata.title,
      sourceUrl: c.metadata.sourceUrl,
      pageNumber: c.metadata.pageNumber,
      chunkIndex: c.metadata.chunkIndex,
      score: c.score,
      excerpt: excerpt(c.content),
    }));
    return { chunks, sources };
  }
}
