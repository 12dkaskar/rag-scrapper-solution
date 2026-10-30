import { MongoClient } from "mongodb";
import {
  closeElasticsearch,
  connectElasticsearch,
  ensureElasticIndices,
  getElasticsearchClient,
  loadEnv,
} from "@rag-scrapper/core";

const BATCH_SIZE = Number(process.env.MIGRATION_BATCH_SIZE ?? "500");

function requireMigrationUri(): string {
  const uri =
    process.env.MIGRATION_MONGODB_URI?.trim() || process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      "Set MIGRATION_MONGODB_URI in .env to your Atlas connection string for one-time migration " +
        "(or set legacy MONGODB_URI to the same value).",
    );
  }
  return uri;
}

function migrationMongoConfig() {
  return {
    database:
      process.env.MIGRATION_MONGODB_DATABASE?.trim() ||
      process.env.MONGODB_DATABASE?.trim() ||
      "rag_app",
    documentsCollection:
      process.env.MIGRATION_MONGODB_DOCUMENTS_COLLECTION?.trim() ||
      process.env.MONGODB_DOCUMENTS_COLLECTION?.trim() ||
      "rag_documents",
    chunksCollection:
      process.env.MIGRATION_MONGODB_CHUNKS_COLLECTION?.trim() ||
      process.env.MONGODB_CHUNKS_COLLECTION?.trim() ||
      "rag_chunks",
  };
}

function toIso(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

/** Mongo `_id` must not be sent as a document field; ES uses `_id` in the bulk action only. */
function sanitizeMongoDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const { _id, ...rest } = doc;
  void _id;
  return {
    ...rest,
    createdAt: toIso(rest.createdAt),
    updatedAt: toIso(rest.updatedAt),
    errorSummary: rest.errorSummary ?? null,
    contentHash: rest.contentHash ?? null,
    sourceUrl: rest.sourceUrl ?? null,
  };
}

function sanitizeMongoChunk(chunk: Record<string, unknown>): Record<string, unknown> {
  const { _id, ...rest } = chunk;
  void _id;
  const metadata = { ...(rest.metadata as Record<string, unknown>) };
  if (metadata.pageNumber === null || metadata.pageNumber === undefined) {
    delete metadata.pageNumber;
  }
  if (metadata.sourceUrl === null) {
    delete metadata.sourceUrl;
  }
  return {
    ...rest,
    metadata,
    createdAt: toIso(rest.createdAt),
  };
}

function logFirstBulkErrors(
  items: { index?: { error?: unknown } }[] | undefined,
  label: string,
): void {
  const errors = items?.filter((item) => item.index?.error).slice(0, 3) ?? [];
  if (errors.length === 0) return;
  console.error(
    `${label} sample error(s):`,
    JSON.stringify(
      errors.map((e) => e.index?.error),
      null,
      2,
    ),
  );
}

async function bulkIndexDocuments(
  index: string,
  docs: Record<string, unknown>[],
): Promise<{ indexed: number; failed: number }> {
  if (docs.length === 0) return { indexed: 0, failed: 0 };
  const client = getElasticsearchClient();
  const operations = docs.flatMap((doc) => {
    const stored = sanitizeMongoDocument(doc);
    const documentId = stored.documentId as string;
    return [{ index: { _index: index, _id: documentId } }, stored];
  });
  const result = await client.bulk({ operations, refresh: false });
  const failed = result.items?.filter((item) => item.index?.error).length ?? 0;
  if (failed > 0) logFirstBulkErrors(result.items, "Documents");
  return { indexed: docs.length - failed, failed };
}

async function bulkIndexChunks(
  index: string,
  chunks: Record<string, unknown>[],
): Promise<{ indexed: number; failed: number }> {
  if (chunks.length === 0) return { indexed: 0, failed: 0 };
  const client = getElasticsearchClient();
  const operations = chunks.flatMap((chunk) => {
    const stored = sanitizeMongoChunk(chunk);
    const documentId = stored.documentId as string;
    const chunkIndex = (stored.metadata as { chunkIndex: number }).chunkIndex;
    return [{ index: { _index: index, _id: `${documentId}:${chunkIndex}` } }, stored];
  });
  const result = await client.bulk({ operations, refresh: false });
  const failed = result.items?.filter((item) => item.index?.error).length ?? 0;
  if (failed > 0) logFirstBulkErrors(result.items, "Chunks");
  return { indexed: chunks.length - failed, failed };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const mongoUri = requireMigrationUri();
  const { database, documentsCollection, chunksCollection } = migrationMongoConfig();

  console.log(`Mongo source: ${database}.${documentsCollection}, ${database}.${chunksCollection}`);

  await connectElasticsearch(env);
  await ensureElasticIndices(env);

  const mongo = new MongoClient(mongoUri);
  await mongo.connect();
  const db = mongo.db(database);

  let docIndexed = 0;
  let docFailed = 0;
  const allDocs = await db.collection(documentsCollection).find({}).toArray();
  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batch = allDocs.slice(i, i + BATCH_SIZE) as Record<string, unknown>[];
    const { indexed, failed } = await bulkIndexDocuments(
      env.ELASTICSEARCH_DOCUMENTS_INDEX,
      batch,
    );
    docIndexed += indexed;
    docFailed += failed;
    console.log(`Documents batch ${Math.floor(i / BATCH_SIZE) + 1}: indexed=${indexed} failed=${failed}`);
  }

  let chunkIndexed = 0;
  let chunkFailed = 0;
  const cursor = db.collection(chunksCollection).find({});
  let batch: Record<string, unknown>[] = [];
  for await (const doc of cursor) {
    batch.push(doc as Record<string, unknown>);
    if (batch.length >= BATCH_SIZE) {
      const { indexed, failed } = await bulkIndexChunks(env.ELASTICSEARCH_CHUNKS_INDEX, batch);
      chunkIndexed += indexed;
      chunkFailed += failed;
      console.log(`Chunks batch: indexed=${indexed} failed=${failed}`);
      batch = [];
    }
  }
  if (batch.length > 0) {
    const { indexed, failed } = await bulkIndexChunks(env.ELASTICSEARCH_CHUNKS_INDEX, batch);
    chunkIndexed += indexed;
    chunkFailed += failed;
    console.log(`Chunks final batch: indexed=${indexed} failed=${failed}`);
  }

  await mongo.close();
  await getElasticsearchClient().indices.refresh({
    index: [env.ELASTICSEARCH_DOCUMENTS_INDEX, env.ELASTICSEARCH_CHUNKS_INDEX],
  });
  await closeElasticsearch();

  console.log(
    JSON.stringify(
      {
        documents: { source: allDocs.length, indexed: docIndexed, failed: docFailed },
        chunks: { indexed: chunkIndexed, failed: chunkFailed },
      },
      null,
      2,
    ),
  );

  if (docFailed > 0 || chunkFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
