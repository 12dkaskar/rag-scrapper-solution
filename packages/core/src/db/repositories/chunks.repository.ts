import { Collection } from "mongodb";
import type { Env } from "../../config/env.js";
import { getDb } from "../mongo.client.js";
import type { RagChunkRecord, RetrievedChunk, SourceType } from "../../types/domain.js";
import { ValidationError } from "../../utils/errors.js";

export class ChunksRepository {
  private collection: Collection<RagChunkRecord>;
  private vectorIndex: string;
  private expectedDimensions: number;

  constructor(env: Env) {
    this.collection = getDb().collection<RagChunkRecord>(env.MONGODB_CHUNKS_COLLECTION);
    this.vectorIndex = env.MONGODB_VECTOR_INDEX;
    this.expectedDimensions = env.EMBEDDING_DIMENSIONS;
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ documentId: 1 });
    await this.collection.createIndex({ createdAt: -1 });
  }

  private validateEmbedding(embedding: number[]): void {
    // Stored vectors must match the configured model dimension before Atlas writes.
    if (embedding.length !== this.expectedDimensions) {
      throw new ValidationError(
        `Embedding dimension mismatch: expected ${this.expectedDimensions}, got ${embedding.length}`,
      );
    }
    if (!embedding.every((n) => typeof n === "number" && Number.isFinite(n))) {
      throw new ValidationError("Embedding must be a finite numeric array");
    }
  }

  async insertMany(chunks: RagChunkRecord[]): Promise<void> {
    for (const chunk of chunks) {
      this.validateEmbedding(chunk.embedding);
    }
    if (chunks.length === 0) return;
    await this.collection.insertMany(chunks);
  }

  async deleteByDocumentId(documentId: string): Promise<number> {
    const result = await this.collection.deleteMany({ documentId });
    return result.deletedCount;
  }

  async vectorSearch(
    queryVector: number[],
    topK: number,
    documentIds?: string[],
    sourceType?: SourceType,
  ): Promise<RetrievedChunk[]> {
    this.validateEmbedding(queryVector);

    const filter: Record<string, unknown> = {};
    if (documentIds && documentIds.length > 0) {
      filter.documentId = { $in: documentIds };
    }
    if (sourceType) {
      filter["metadata.sourceType"] = sourceType;
    }

    // Atlas $vectorSearch: index path and filter fields must match atlas vector index definition.
    const pipeline: object[] = [
      {
        $vectorSearch: {
          index: this.vectorIndex,
          path: "embedding",
          queryVector,
          numCandidates: Math.max(topK * 10, 100),
          limit: topK,
          ...(Object.keys(filter).length > 0 ? { filter } : {}),
        },
      },
      {
        $project: {
          documentId: 1,
          content: 1,
          metadata: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const cursor = this.collection.aggregate<{
      documentId: string;
      content: string;
      metadata: RagChunkRecord["metadata"];
      score: number;
    }>(pipeline);

    const results = await cursor.toArray();
    return results.map((r) => ({
      documentId: r.documentId,
      content: r.content,
      metadata: r.metadata,
      score: r.score,
    }));
  }
}
