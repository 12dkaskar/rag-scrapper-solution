# HTTP API

Base URL: `http://localhost:3001` (API) or `http://localhost:3000/api` (via Next). All JSON errors include `error.code`, `error.message`, and `error.requestId`.

## Health

### `GET /health`

Liveness probe. Does not check Elasticsearch.

**Response:** `{ "status": "ok" }`

### `GET /ready`

Readiness probe. Pings Elasticsearch.

**Response:** `{ "status": "ready", "elasticsearch": true }` or `503` if Elasticsearch is unavailable.

---

## Ingestion

### `POST /api/ingest/url`

**Body:**

```json
{ "url": "https://example.com/article" }
```

**Response `202`:**

```json
{ "documentId": "uuid", "status": "completed" }
```

Synchronous processing: the request completes when ingestion finishes or fails.

### `POST /api/ingest/pdf`

**Content-Type:** `multipart/form-data`  
**Field:** `file` (PDF)

**Response `202`:** same shape as URL ingest.

### `GET /api/ingest/:documentId/status`

**Response:**

```json
{
  "documentId": "uuid",
  "status": "completed",
  "chunkCount": 12,
  "title": "Page title",
  "sourceType": "web",
  "sourceUrl": "https://example.com",
  "errorSummary": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

## Documents

### `GET /api/documents?page=1&limit=20`

Lists document metadata (no embeddings or full text).

### `DELETE /api/documents/:documentId`

Deletes the document record and all chunks with that `documentId`.

**Response:**

```json
{ "documentId": "uuid", "deleted": true, "deletedChunks": 12 }
```

---

## Chat

### `POST /api/chat`

**Body:**

```json
{
  "question": "What does the source say about RAG?",
  "documentIds": ["optional-uuid"],
  "topK": 5
}
```

**Response:**

```json
{
  "answer": "...",
  "sources": [
    {
      "documentId": "uuid",
      "title": "Example",
      "sourceUrl": "https://example.com",
      "pageNumber": null,
      "chunkIndex": 0,
      "score": 0.82,
      "excerpt": "Short excerpt…"
    }
  ],
  "retrieval": { "topK": 5, "returnedChunks": 3 }
}
```

When no chunks are retrieved, `sources` is empty and `answer` explains that indexed sources lack sufficient information (LLM is not called).

---

## Error codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid input (Zod or business validation) |
| 404 | `NOT_FOUND` | Document not found |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 502 | `PROVIDER_ERROR` | Embedding or generation provider failure |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
