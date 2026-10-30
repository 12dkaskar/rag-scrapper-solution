import type { Env } from "../../config/env.js";
import { getElasticsearchClient } from "../elastic.client.js";
import { ensureElasticIndices } from "../elastic-indices.js";
import type { RagChunkRecord, RetrievedChunk, SourceType } from "../../types/domain.js";
import { ValidationError } from "../../utils/errors.js";

type StoredChunk = Omit<RagChunkRecord, "createdAt"> & { createdAt: string };

function chunkId(chunk: Pick<RagChunkRecord, "documentId" | "metadata">): string {
  return `${chunk.documentId}:${chunk.metadata.chunkIndex}`;
}

function toStored(chunk: RagChunkRecord): StoredChunk {
  return { ...chunk, createdAt: chunk.createdAt.toISOString() };
}

export class ChunksRepository {
  private index: string;
  private env: Env;
  private expectedDimensions: number;

  constructor(env: Env) {
    this.env = env;
    this.index = env.ELASTICSEARCH_CHUNKS_INDEX;
    this.expectedDimensions = env.EMBEDDING_DIMENSIONS;
  }

  async ensureIndexes(): Promise<void> {
    await ensureElasticIndices(this.env);
  }

  private validateEmbedding(embedding: number[]): void {
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

    const client = getElasticsearchClient();
    const operations = chunks.flatMap((chunk) => [
      { index: { _index: this.index, _id: chunkId(chunk) } },
      toStored(chunk),
    ]);
    const result = await client.bulk({ operations, refresh: "wait_for" });
    if (result.errors) {
      const first = result.items?.find((item) => {
        const op = item.index ?? item.create;
        return op?.error;
      });
      const err = first?.index?.error ?? first?.create?.error;
      throw new ValidationError(`Elasticsearch bulk index failed: ${err?.reason ?? "unknown"}`);
    }
  }

  async deleteByDocumentId(documentId: string): Promise<number> {
    const client = getElasticsearchClient();
    const result = await client.deleteByQuery({
      index: this.index,
      query: { term: { documentId } },
      refresh: true,
    });
    return result.deleted ?? 0;
  }

  async vectorSearch(
    queryVector: number[],
    topK: number,
    documentIds?: string[],
    sourceType?: SourceType,
  ): Promise<RetrievedChunk[]> {
    this.validateEmbedding(queryVector);

    const filterClauses: object[] = [];
    if (documentIds && documentIds.length > 0) {
      filterClauses.push({ terms: { documentId: documentIds } });
    }
    if (sourceType) {
      filterClauses.push({ term: { "metadata.sourceType": sourceType } });
    }

    const client = getElasticsearchClient();
    const result = await client.search<StoredChunk>({
      index: this.index,
      knn: {
        field: "embedding",
        query_vector: queryVector,
        k: topK,
        num_candidates: Math.max(topK * 10, 100),
        ...(filterClauses.length > 0
          ? { filter: { bool: { filter: filterClauses } } }
          : {}),
      },
      _source: ["documentId", "content", "metadata"],
    });

    return result.hits.hits.map((hit) => {
      const source = hit._source!;
      return {
        documentId: source.documentId,
        content: source.content,
        metadata: source.metadata,
        score: hit._score ?? 0,
      };
    });
  }
}
