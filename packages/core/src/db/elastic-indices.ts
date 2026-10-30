import type { Env } from "../config/env.js";
import { getElasticsearchClient } from "./elastic.client.js";

function documentsMappings() {
  return {
    properties: {
      documentId: { type: "keyword" },
      sourceType: { type: "keyword" },
      sourceUrl: { type: "keyword" },
      title: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 512 } } },
      status: { type: "keyword" },
      chunkCount: { type: "integer" },
      contentHash: { type: "keyword" },
      errorSummary: { type: "text" },
      createdAt: { type: "date" },
      updatedAt: { type: "date" },
    },
  } as const;
}

function chunksMappings(dims: number) {
  return {
    properties: {
      documentId: { type: "keyword" },
      content: { type: "text" },
      embedding: {
        type: "dense_vector",
        dims,
        index: true,
        similarity: "cosine",
      },
      metadata: {
        properties: {
          sourceType: { type: "keyword" },
          sourceUrl: { type: "keyword" },
          title: { type: "text" },
          chunkIndex: { type: "integer" },
          pageNumber: { type: "integer" },
        },
      },
      embeddingModel: { type: "keyword" },
      embeddingProvider: { type: "keyword" },
      embeddingDimensions: { type: "integer" },
      createdAt: { type: "date" },
    },
  } as const;
}

async function createIndexIfMissing(
  index: string,
  mappings: Record<string, unknown>,
): Promise<void> {
  const client = getElasticsearchClient();
  const exists = await client.indices.exists({ index });
  if (exists) return;
  await client.indices.create({
    index,
    mappings,
  });
}

export async function ensureElasticIndices(env: Env): Promise<void> {
  await createIndexIfMissing(env.ELASTICSEARCH_DOCUMENTS_INDEX, documentsMappings());
  await createIndexIfMissing(
    env.ELASTICSEARCH_CHUNKS_INDEX,
    chunksMappings(env.EMBEDDING_DIMENSIONS),
  );
}
