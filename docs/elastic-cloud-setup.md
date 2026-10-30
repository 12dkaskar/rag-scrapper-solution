# Elasticsearch (Elastic Cloud) setup

This application stores document metadata in **`rag_documents`** and chunks with embeddings in **`rag_chunks`**. Vector retrieval uses Elasticsearch **dense_vector** kNN on the `embedding` field.

## Prerequisites

- An [Elastic Cloud](https://cloud.elastic.co/) deployment (Elasticsearch 8.x).
- Node.js **20+** on the machine running the API.

## 1. Create deployment and API key

1. In Elastic Cloud, create or open a deployment in a region close to your API.
2. Copy the Elasticsearch **HTTPS endpoint** (host URL).
3. Under **Management → API keys**, create an API key with privileges to manage and read/write indices matching `rag_*` (or your configured index names).
4. Note the **encoded** API key string for `.env`.

## 2. Configure `.env`

From [`.env.example`](../.env.example):

| Variable | Description |
|----------|-------------|
| `ELASTICSEARCH_URL` | Cloud endpoint, e.g. `https://….es.io:443` |
| `ELASTICSEARCH_API_KEY` | Encoded API key |
| `ELASTICSEARCH_DOCUMENTS_INDEX` | Default `rag_documents` |
| `ELASTICSEARCH_CHUNKS_INDEX` | Default `rag_chunks` |
| `EMBEDDING_DIMENSIONS` | Must match `dense_vector` dims (768 for default Gemini stack) |

## 3. Create indices (mappings + vector field)

After `.env` is set:

```bash
npm run ensure-indexes
```

This creates both indices if missing, including **`dense_vector`** on `embedding` with cosine similarity. Reference mappings: [elastic-chunks-mapping.json](./elastic-chunks-mapping.json) and [elastic-index-mappings.json](./elastic-index-mappings.json).

If you change `EMBEDDING_DIMENSIONS` or embedding model, create a **new** chunks index (or reindex) and re-ingest all documents.

## 4. Verify

1. Start the stack: `npm run dev`
2. `GET http://localhost:3001/ready` should return `{ "status": "ready", "elasticsearch": true }`
3. Ingest a URL or PDF via the UI, then chat — retrieval uses kNN on `rag_chunks`.

Optional diagnostic:

```bash
npx tsx scripts/debug-retrieval.ts
npx tsx scripts/debug-retrieval.ts <documentId>
```

## 5. Migrate from MongoDB Atlas (one-time)

If you have existing Atlas data:

1. Set `MIGRATION_MONGODB_URI` in `.env` to your Atlas connection string (or set legacy `MONGODB_URI` to the same value). Optional: `MIGRATION_MONGODB_DATABASE`, `MIGRATION_MONGODB_*_COLLECTION` if non-default.
2. Ensure Elasticsearch indices exist: `npm run ensure-indexes`
3. Run:

```bash
npm run migrate:mongo-to-elastic
```

4. Remove `MIGRATION_MONGODB_URI` from `.env` when done.

## 6. Kibana (same Elastic Cloud deployment)

1. Open **Kibana** from your cloud deployment.
2. **Stack Management → Data views**: create views for `rag_documents` and `rag_chunks`.
3. Use **Discover** for counts and sample fields (avoid exposing sensitive PDF text in shared spaces).
4. Optional: dashboard panels for index document count and cluster health.

Kibana is not required for the RAG API to function.

## Troubleshooting

| Symptom | Likely cause |
|--------|----------------|
| `/ready` → `elasticsearch: false` | Wrong URL/API key, or deployment unreachable |
| Dimension mismatch on ingest | `EMBEDDING_DIMENSIONS` ≠ index `dense_vector.dims` |
| No chat sources | Empty chunks index, wrong index names in `.env`, or filters too strict |
| kNN errors after mapping change | Old index mapping; create new index and re-ingest |
