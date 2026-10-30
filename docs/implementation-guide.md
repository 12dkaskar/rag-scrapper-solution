# RAG Application — Architecture and Implementation Guide

## 1. Purpose

This application implements Retrieval-Augmented Generation (RAG) over user-provided web pages and PDF documents. It uses a Node.js/TypeScript backend, **Elasticsearch** (Elastic Cloud) for vector retrieval, and hosted AI APIs (Gemini by default, OpenAI optional) for embeddings and answer generation.

RAG grounds a language model's response in retrieved source material. It does not guarantee correctness; source quality, retrieval quality, prompt design, and model behavior still matter.

## 2. High-level design (HLD)

HLD describes **what** the system does and **which major parts** interact, without file-level detail. A complementary diagram lives in [architecture.md](./architecture.md).

### 2.1 System context

External actors and systems:

```mermaid
flowchart LR
    subgraph clients [Clients]
        Browser[Next.js UI :3000]
        Postman[Postman / curl]
    end

    subgraph web [Web tier]
        Next[Next.js rewrites /api]
    end

    subgraph rag_api [API tier]
        API[NestJS API :3001]
    end

    subgraph data [Data plane]
        ES[(Elasticsearch)]
        VS[dense_vector kNN]
        ES --- VS
    end

    subgraph ai [Hosted AI]
        Gemini[Gemini API]
        OpenAI[OpenAI API optional]
    end

    subgraph external [External content]
        WebPages[HTTPS web pages]
    end

    Postman --> API
    Browser --> Next
    Next --> API
    API --> ES
    API --> Gemini
    API -.-> OpenAI
    API --> WebPages
```

| Boundary | Trust |
|----------|--------|
| Client → API | Untrusted input (URLs, PDFs, questions) |
| API → web | Untrusted HTML; SSRF controls apply |
| API → Elasticsearch | Private credentials; full chunk text stored |
| API → AI providers | Private API keys; prompts include retrieved text |

### 2.2 Container view (major subsystems)

```mermaid
flowchart TB
    subgraph http [HTTP layer]
        Routes[routes: health ingest documents chat]
        MW[middleware: CORS rate-limit errors request-id]
    end

    subgraph services [Application services]
        Ingest[IngestionService]
        RAG[RagService]
        Retrieve[RetrievalService]
        Chunk[ChunkingService]
    end

    subgraph adapters [Provider adapters]
        Emb[EmbeddingProvider]
        Gen[GenerationProvider]
    end

    subgraph loaders [Loaders]
        WebL[web.loader]
        PdfL[pdf.loader]
    end

    subgraph persistence [Persistence]
        DocRepo[DocumentsRepository]
        ChunkRepo[ChunksRepository]
    end

    Routes --> Ingest
    Routes --> RAG
    Routes --> DocRepo
    Ingest --> WebL
    Ingest --> PdfL
    Ingest --> Chunk
    Ingest --> Emb
    Ingest --> DocRepo
    Ingest --> ChunkRepo
    RAG --> Retrieve
    RAG --> Gen
    Retrieve --> Emb
    Retrieve --> ChunkRepo
    Emb --> GeminiExt[Gemini / OpenAI]
    Gen --> GeminiExt
    ChunkRepo --> ESDB[(Elasticsearch indices)]
    DocRepo --> ESDB
```

### 2.3 Data flow summary

| Flow | Path |
|------|------|
| **Ingest** | Client → validate → load text → chunk → embed → write `rag_documents` + `rag_chunks` |
| **Chat** | Client → embed question → vector search → build context → generate answer + cite sources |
| **Delete** | Client → remove document row + all chunks for `documentId` |

## 3. Low-level design (LLD)

LLD maps **modules, sequences, and persistence** to the codebase (`src/`).

### 3.1 Module dependency (composition root)

Wiring is centralized in `createAppContext` (`src/app-context.ts`):

```mermaid
flowchart TD
    Env[loadEnv - config/env.ts]

    Env --> EmbFactory[createEmbeddingProvider]
    Env --> GenFactory[createGenerationProvider]
    Env --> DocRepo[DocumentsRepository]
    Env --> ChunkRepo[ChunksRepository]
    Env --> Chunking[ChunkingService]

    EmbFactory --> Emb[EmbeddingProvider]
    GenFactory --> Gen[GenerationProvider]

    DocRepo --> Ingest[IngestionService]
    ChunkRepo --> Ingest
    Emb --> Ingest
    Chunking --> Ingest

    ChunkRepo --> Retrieval[RetrievalService]
    Emb --> Retrieval

    Retrieval --> Rag[RagService]
    Gen --> Rag

    Ingest --> Ctx[AppContext]
    Rag --> Ctx
    DocRepo --> Ctx
    ChunkRepo --> Ctx
```

### 3.2 HTTP routing map

```mermaid
flowchart LR
    App[createApp - app.ts]

    App --> H[/health /ready]
    App --> I[/api/ingest/url POST]
    App --> P[/api/ingest/pdf POST]
    App --> S[/api/ingest/:id/status GET]
    App --> D[/api/documents GET DELETE]
    App --> C[/api/chat POST]

    I --> IngestSvc[IngestionService]
    P --> IngestSvc
    S --> IngestSvc
    D --> DocRepo[DocumentsRepository]
    C --> RagSvc[RagService]
```

| Route | Schema / input | Service |
|-------|----------------|---------|
| `POST /api/ingest/url` | `ingestUrlSchema` | `ingestUrl` |
| `POST /api/ingest/pdf` | multer `file` | `ingestPdf` |
| `POST /api/chat` | `chatRequestSchema` | `chat` |

### 3.3 Sequence — URL / PDF ingestion

```mermaid
sequenceDiagram
    participant Client
    participant Route as ingest.routes
    participant Ing as IngestionService
    participant Load as web.loader or pdf.loader
    participant Chk as ChunkingService
    participant Emb as EmbeddingProvider
    participant Doc as DocumentsRepository
    participant Ch as ChunksRepository
    participant ES as Elasticsearch

    Client->>Route: POST url or PDF
    Route->>Ing: ingestUrl / ingestPdf
    Ing->>Doc: insert pending document
    Ing->>Load: extract text
    Load-->>Ing: pages or single body
    Ing->>Chk: split chunks
    Chk-->>Ing: chunk texts + metadata
    loop batches of 16
        Ing->>Emb: embedTexts
        Emb-->>Ing: vectors
    end
    Ing->>Ch: insertMany validate dims
    Ch->>ES: bulk index rag_chunks
    Ing->>Doc: completed + chunkCount
    Ing-->>Route: documentId status
    Route-->>Client: 202 JSON

    Note over Ing,Ch: On failure delete partial chunks set status failed
```

### 3.4 Sequence — chat (RAG)

```mermaid
sequenceDiagram
    participant Client
    participant Route as chat.routes
    participant Rag as RagService
    participant Ret as RetrievalService
    participant Emb as EmbeddingProvider
    participant Ch as ChunksRepository
    participant ES as Elasticsearch kNN
    participant Gen as GenerationProvider

    Client->>Route: POST question documentIds topK
    Route->>Rag: chat
    Rag->>Ret: retrieve
    Ret->>Emb: embedTexts question
    Emb-->>Ret: queryVector
    Ret->>Ch: vectorSearch
    Ch->>ES: knn search on embedding
    ES-->>Ch: top K chunks
    Ch-->>Ret: RetrievedChunk
    Ret-->>Rag: chunks sources

    alt returnedChunks equals 0
        Rag-->>Route: fixed no-context message
    else has chunks
        Rag->>Gen: generateAnswer + context blocks
        Gen-->>Rag: answer
        Rag-->>Route: answer sources retrieval
    end
    Route-->>Client: 200 JSON
```

### 3.5 Vector search pipeline (repository)

Implemented in `ChunksRepository.vectorSearch`:

```mermaid
flowchart LR
    Q[queryVector 768-dim] --> VS["kNN dense_vector"]
    VS --> F{filter?}
    F -->|documentIds| FD["documentId $in"]
    F -->|none| All[all chunks in index]
    VS --> Proj[project score content metadata]
    Proj --> Out[RetrievedChunk array]
```

Index mapping must match `ELASTICSEARCH_CHUNKS_INDEX`, field `embedding`, and `EMBEDDING_DIMENSIONS` — see [elastic-chunks-mapping.json](./elastic-chunks-mapping.json).

### 3.6 Entity relationship (logical)

```mermaid
erDiagram
    RAG_DOCUMENTS ||--o{ RAG_CHUNKS : documentId
    RAG_DOCUMENTS {
        string documentId PK
        string sourceType
        string status
        int chunkCount
        string contentHash
    }
    RAG_CHUNKS {
        string documentId FK
        string content
        float_array embedding
        object metadata
        string embeddingModel
    }
```

## 4. Main components

| Component | Responsibility | Implementation file(s) |
|-----------|----------------|------------------------|
| HTTP API | Routes, validation, contracts | `src/app.ts`, `src/routes/*.ts`, `src/schemas/*.ts` |
| Ingestion service | URL/PDF orchestration, status | `src/services/ingestion.service.ts` |
| Web loader | Safe fetch + HTML text | `src/loaders/web.loader.ts`, `src/utils/url-safety.ts` |
| PDF loader | Validate + extract pages | `src/loaders/pdf.loader.ts` |
| Chunking | Split text, preserve metadata | `src/services/chunking.service.ts` |
| Embedding provider | Hosted embeddings | `src/providers/embeddings/*` |
| Elasticsearch repository | Persist + kNN search | `packages/core/src/db/repositories/*.ts` |
| Retrieval service | Query embed + search | `src/services/retrieval.service.ts` |
| Generation provider | Grounded answers | `src/providers/generation/*` |
| Configuration | Env validation | `src/config/env.ts` |
| Tests | Unit tests (mocked) | `tests/*.test.ts` |

## 5. Document ingestion lifecycle

Implemented in `IngestionService`:

1. Client submits URL or PDF.
2. Loader extracts text; URL path applies SSRF checks (DNS + redirect validation).
3. `ChunkingService` splits text with `CHUNK_SIZE` / `CHUNK_OVERLAP`.
4. `EmbeddingProvider` embeds chunks in batches of 16.
5. `ChunksRepository` validates dimensions and inserts into `rag_chunks`.
6. `rag_documents` moves `pending` → `processing` → `completed` or `failed`.
7. Duplicate canonical URL or PDF hash returns existing completed document when found.

On failure, partial chunks are deleted before status is set to `failed` (compensation pattern in `ingestion.service.ts`).

## 6. Question-answering lifecycle

Implemented in `RagService` + `RetrievalService`:

1. `POST /api/chat` validates body via Zod.
2. Question is embedded with the configured embedding provider.
3. kNN search runs on `rag_chunks` (see `chunks.repository.ts`).
4. Context is built with `MAX_CONTEXT_CHARS` cap.
5. If zero chunks, a fixed message is returned **without** calling the LLM.
6. Otherwise `GenerationProvider` receives grounding instructions from `prompts.ts`.

## 7. Elasticsearch data model

### `rag_documents`

- `documentId`, `sourceType`, `sourceUrl`, `title`, `status`, `chunkCount`, `contentHash`, `errorSummary`, `createdAt`, `updatedAt`

### `rag_chunks`

- `documentId`, `content`, `embedding` (number[]), `metadata` (sourceType, sourceUrl, title, chunkIndex, pageNumber)
- `embeddingProvider`, `embeddingModel`, `embeddingDimensions`, `createdAt`

## 8. Chunks index (vector field)

Default Gemini configuration:

- Index: `rag_chunks` (`ELASTICSEARCH_CHUNKS_INDEX`)
- Field: `embedding` (`dense_vector`)
- Dimensions: **768** (`EMBEDDING_DIMENSIONS`)
- Similarity: cosine
- Filter: `documentId` keyword (used when chat passes `documentIds`)

Mappings: [elastic-chunks-mapping.json](./elastic-chunks-mapping.json). Setup: [elastic-cloud-setup.md](./elastic-cloud-setup.md).

**Indices and vector mapping** are created by `npm run ensure-indexes` when connected to Elasticsearch.

## 9. Provider abstraction

- `createEmbeddingProvider` / `createGenerationProvider` in `src/providers/*/index.ts`
- Env: `EMBEDDING_PROVIDER`, `GENERATION_PROVIDER` (`openai` | `gemini`)
- API keys validated conditionally in `src/config/env.ts`

Default models (`.env.example`):

- Embedding: `gemini-embedding-001` (768 dims via `outputDimensionality`)
- Generation: `gemini-3.5-flash-lite` (use a current Gemini flash model for your API key)

## 10. Security and privacy

| Control | Implementation |
|---------|----------------|
| Secrets server-only | Keys only in env; `.env` gitignored |
| SSRF | `url-safety.ts` + manual redirect handling in `web.loader.ts` |
| PDF limits | Magic bytes, `MAX_PDF_SIZE_MB`, multer limit |
| Rate limiting | `express-rate-limit` |
| CORS | Explicit `CORS_ORIGINS` list |
| Request IDs | `x-request-id` middleware |
| Logging | Pino; redacts authorization header |
| Deletion | `DELETE /api/documents/:id` removes chunks + document |

**Limitation:** Redirect targets are validated per hop, but URL ingestion should not be exposed to untrusted users without additional network controls.

## 11. API reference

See [api.md](./api.md).

## 12. Configuration and setup

Copy `.env.example` to `.env` and set at minimum:

- `ELASTICSEARCH_URL` and `ELASTICSEARCH_API_KEY`
- `GEMINI_API_KEY` (for default providers)
- `EMBEDDING_MODEL=gemini-embedding-001` and `EMBEDDING_DIMENSIONS=768`

## 13. Testing and validation

Commands (Node 20+):

```bash
npm install
npm run typecheck
npm test
npm run build
```

- **Unit tests:** mocked providers/DB where needed — no live Elasticsearch or API keys required.
- **Integration:** Not automated; use Elastic Cloud + keys locally after `ensure-indexes`.

## 14. Operational considerations

- Synchronous ingestion may hit `REQUEST_TIMEOUT_MS` on large PDFs.
- Changing embedding model requires new index dimensions and full re-ingest.
- OCR and hybrid search are out of scope.

## 15. Implementation record

| Item | Value |
|------|--------|
| Package manager | npm |
| Node | >= 20 (engines in `package.json`) |
| Embedding default | Gemini `gemini-embedding-001`, 768 dimensions |
| Generation default | Gemini `gemini-3.5-flash-lite` (verify against your API key) |
| Database | Elasticsearch indices `rag_documents`, `rag_chunks` |
| Vector search | kNN on `embedding` in chunks index |
| Endpoints | `/health`, `/ready`, `/api/ingest/*`, `/api/documents`, `/api/chat` |
| Manual setup | Elastic Cloud deployment, API key, `.env`, `npm run ensure-indexes` |
