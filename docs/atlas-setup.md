# MongoDB Atlas setup

This application stores chunks in `rag_chunks` and document metadata in `rag_documents`. Vector retrieval uses **Atlas Vector Search** on the `embedding` field.

## Prerequisites

- MongoDB Atlas cluster on a tier that supports **Vector Search** (verify in Atlas for your account/region).
- Node.js **20+** on the machine running the API.

## 1. Create database and collections

1. In Atlas, open your cluster → **Browse Collections**.
2. Create database `rag_app` (or match `MONGODB_DATABASE` in `.env`).
3. Collections are created automatically on first write, or create empty collections:
   - `rag_documents`
   - `rag_chunks`

## 2. Standard indexes

After configuring `.env`, run:

```bash
npm run ensure-indexes
```

This creates non-vector indexes (`documentId`, `status`, `createdAt`, etc.). It does **not** create the vector search index.

## 3. Vector Search index (manual)

Default embedding stack (Gemini):

| Setting | Value |
|--------|--------|
| Model | `text-embedding-004` |
| Dimensions | **768** (`EMBEDDING_DIMENSIONS`) |
| Index name | `rag_vector_index` (`MONGODB_VECTOR_INDEX`) |
| Vector field | `embedding` |
| Similarity | cosine |

1. Atlas → cluster → **Search** (or **Atlas Search** / Vector Search UI depending on Atlas version).
2. Create a **Vector Search** index on collection `rag_chunks` in database `rag_app`.
3. Use the JSON definition in [vector-index.json](./vector-index.json).
4. Set `numDimensions` to match `EMBEDDING_DIMENSIONS` exactly. If you change embedding model or dimensions, update the index and re-embed all chunks.

### Filter fields

Chat filters by `documentId` during `$vectorSearch`. Index **`documentId`** as a **filter** field (see [vector-index.json](./vector-index.json)).

In the Atlas **JSON editor**, paste only the `fields` array wrapper below—do **not** repeat `"name"` if the wizard already set the index name to `default` (or `rag_vector_index`).

If Atlas shows **invalid field name**, remove nested paths like `metadata.sourceType` and use the minimal definition in `vector-index.json`.

## 4. Connection string

Set `MONGODB_URI` in `.env` to your Atlas connection string (never commit real credentials).

## 5. Verify

1. Start the API: `npm run dev`
2. `GET http://localhost:3000/ready` should return `{ "status": "ready", "mongo": true }`.
3. Ingest a URL, then run chat — if vector index is missing or dimensions mismatch, ingestion or chat will error (check server logs).

## Troubleshooting

| Symptom | Likely cause |
|--------|----------------|
| `$vectorSearch` not found | Vector index not built or wrong collection/database |
| Dimension mismatch | `EMBEDDING_DIMENSIONS` ≠ index `numDimensions` or ≠ model output |
| No results | Empty collection, wrong index name (`MONGODB_VECTOR_INDEX`), or filters too strict |
| Mixed models | Chunks embedded with a different model than query embeddings — re-ingest after model change |
