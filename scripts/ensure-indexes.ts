import {
  ChunksRepository,
  closeMongo,
  connectMongo,
  DocumentsRepository,
  loadEnv,
} from "@rag-scrapper/core";

async function main(): Promise<void> {
  const env = loadEnv();
  await connectMongo(env);
  const documents = new DocumentsRepository(env);
  const chunks = new ChunksRepository(env);
  await documents.ensureIndexes();
  await chunks.ensureIndexes();
  console.log("Standard indexes ensured on documents and chunks collections.");
  console.log(
    "Reminder: create the Atlas Vector Search index manually — see docs/atlas-setup.md",
  );
  await closeMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
