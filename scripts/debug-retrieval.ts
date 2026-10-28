import { loadEnv, closeMongo, connectMongo } from "@rag-scrapper/core";
import { getDb } from "../packages/core/src/db/mongo.client.js";

const documentId = process.argv[2];

async function main(): Promise<void> {
  const env = loadEnv();
  await connectMongo(env);
  const coll = getDb().collection(env.MONGODB_CHUNKS_COLLECTION);

  const total = await coll.countDocuments();
  const forDoc = documentId ? await coll.countDocuments({ documentId }) : null;
  const one = await coll.findOne(
    documentId ? { documentId } : {},
    { projection: { content: 1, documentId: 1, embedding: { $slice: 1 } } },
  );
  const full = documentId
    ? await coll.findOne({ documentId }, { projection: { embedding: 1 } })
    : await coll.findOne({}, { projection: { embedding: 1 } });

  let searchIndexes: unknown;
  try {
    searchIndexes = await coll.aggregate([{ $listSearchIndexes: {} }]).toArray();
  } catch (e) {
    searchIndexes = { error: String(e) };
  }

  console.log(
    JSON.stringify(
      {
        database: env.MONGODB_DATABASE,
        collection: env.MONGODB_CHUNKS_COLLECTION,
        vectorIndexName: env.MONGODB_VECTOR_INDEX,
        expectedDimensions: env.EMBEDDING_DIMENSIONS,
        totalChunks: total,
        chunksForDocumentId: forDoc,
        sampleDocumentId: one?.documentId,
        embeddingLength: full?.embedding?.length ?? 0,
        searchIndexes,
      },
      null,
      2,
    ),
  );

  await closeMongo();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
