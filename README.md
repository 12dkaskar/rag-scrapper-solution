# rag-scrapper-solution

Node.js monorepo: **NestJS API** + **Next.js UI** for RAG over web pages and PDFs, with **Elasticsearch** (Elastic Cloud) vector search and **Gemini** (or OpenAI) for embeddings and answers.

## Quick start

```bash
npm install
cp .env.example .env
# Set ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY, GEMINI_API_KEY, EMBEDDING_MODEL, GENERATION_MODEL, etc.
npm run ensure-indexes
# See docs/elastic-cloud-setup.md
npm run dev
```

Open **http://localhost:3000** (UI). API listens on **http://localhost:3001** (proxied via Next as `/api/*`).

## Monorepo layout

| Package | Path | Role |
|---------|------|------|
| `@rag-scrapper/core` | `packages/core` | RAG domain logic (ingest, retrieval, providers, Elasticsearch repos) |
| `@rag-scrapper/api` | `apps/api` | NestJS HTTP API |
| `@rag-scrapper/web` | `apps/web` | Next.js frontend |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build core + start API (3001) and web (3000) |
| `npm run build` | Production build (core → api → web) |
| `npm start` | Run production API + web |
| `npm test` | Vitest unit tests |
| `npm run ensure-indexes` | Create Elasticsearch indices and mappings |
| `npm run migrate:mongo-to-elastic` | One-time Atlas → Elasticsearch migration |

## Environment

Root [`.env.example`](.env.example):

- `PORT=3001` — API port
- `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY`
- `ELASTICSEARCH_CHUNKS_INDEX`, `ELASTICSEARCH_DOCUMENTS_INDEX`
- `GEMINI_API_KEY`
- `EMBEDDING_MODEL=gemini-embedding-001`, `EMBEDDING_DIMENSIONS=768`
- `GENERATION_MODEL` — e.g. `gemini-3.5-flash-lite`

Optional [`apps/web/.env.example`](apps/web/.env.example): `API_INTERNAL_URL` for Next rewrites (default `http://127.0.0.1:3001`).

**Large PDF uploads:** The UI posts to `/api/*` through Next (default **10MB** body buffer unless configured). This repo sets `experimental.middlewareClientMaxBodySize` from root `MAX_PDF_SIZE_MB` (+ 3MB headroom) and a **15-minute** `proxyTimeout`. After changing `.env` or `next.config.ts`, restart `npm run dev`. For very large files, call the API directly at **http://localhost:3001/api/ingest/pdf**.

## Documentation

- [Architecture](docs/architecture.md)
- [Implementation guide](docs/implementation-guide.md) (HLD / LLD)
- [API](docs/api.md)
- [Elastic Cloud setup](docs/elastic-cloud-setup.md)

## Production notes

1. `npm run build && npm start`
2. Set `NODE_ENV=production` and production secrets on the host
3. Point `API_INTERNAL_URL` at the internal Nest URL from the Next server
4. Do not expose API keys to the browser (all AI calls stay on the API)
