import {
  closeElasticsearch,
  connectElasticsearch,
  loadEnv,
} from "@rag-scrapper/core";
import { getElasticsearchClient } from "../packages/core/src/db/elastic.client.js";

const documentId = process.argv[2];

async function main(): Promise<void> {
  const env = loadEnv();
  await connectElasticsearch(env);
  const client = getElasticsearchClient();
  const chunksIndex = env.ELASTICSEARCH_CHUNKS_INDEX;

  const total = await client.count({ index: chunksIndex });
  const forDoc = documentId
    ? await client.count({ index: chunksIndex, query: { term: { documentId } } })
    : null;

  const sample = await client.search<{ documentId?: string; embedding?: number[] }>({
    index: chunksIndex,
    size: 1,
    query: documentId ? { term: { documentId } } : { match_all: {} },
    _source: ["documentId", "embedding"],
  });

  const hit = sample.hits.hits[0];
  const embeddingLength = Array.isArray(hit?._source?.embedding) ? hit._source.embedding.length : 0;

  let mapping: unknown;
  try {
    mapping = await client.indices.getMapping({ index: chunksIndex });
  } catch (e) {
    mapping = { error: String(e) };
  }

  console.log(
    JSON.stringify(
      {
        chunksIndex,
        documentsIndex: env.ELASTICSEARCH_DOCUMENTS_INDEX,
        expectedDimensions: env.EMBEDDING_DIMENSIONS,
        totalChunks: total.count,
        chunksForDocumentId: forDoc?.count ?? null,
        sampleDocumentId: hit?._source?.documentId,
        embeddingLength,
        mapping,
      },
      null,
      2,
    ),
  );

  await closeElasticsearch();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
