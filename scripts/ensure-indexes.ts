import {
  closeElasticsearch,
  connectElasticsearch,
  ensureElasticIndices,
  loadEnv,
} from "@rag-scrapper/core";

async function main(): Promise<void> {
  const env = loadEnv();
  await connectElasticsearch(env);
  await ensureElasticIndices(env);
  console.log(
    `Elasticsearch indices ensured: ${env.ELASTICSEARCH_DOCUMENTS_INDEX}, ${env.ELASTICSEARCH_CHUNKS_INDEX}`,
  );
  console.log("Vector field mapping is included on the chunks index (dense_vector).");
  await closeElasticsearch();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
