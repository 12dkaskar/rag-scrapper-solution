import { resetEnvCache } from "@rag-scrapper/core";

export const baseTestEnv: Record<string, string> = {
  NODE_ENV: "test",
  PORT: "3001",
  ELASTICSEARCH_URL: "https://localhost:9200",
  ELASTICSEARCH_API_KEY: "test-elastic-api-key",
  ELASTICSEARCH_CHUNKS_INDEX: "rag_chunks_test",
  ELASTICSEARCH_DOCUMENTS_INDEX: "rag_documents_test",
  EMBEDDING_PROVIDER: "gemini",
  EMBEDDING_MODEL: "gemini-embedding-001",
  EMBEDDING_DIMENSIONS: "768",
  GENERATION_PROVIDER: "gemini",
  GENERATION_MODEL: "gemini-3.5-flash-lite",
  GEMINI_API_KEY: "test-gemini-key",
  CHUNK_SIZE: "200",
  CHUNK_OVERLAP: "20",
  RAG_TOP_K: "5",
  MAX_CONTEXT_CHARS: "5000",
  MAX_PDF_SIZE_MB: "10",
  MAX_FETCH_BYTES: "100000",
  REQUEST_TIMEOUT_MS: "5000",
  CORS_ORIGINS: "http://localhost:3000",
};

export function withTestEnv(overrides?: Record<string, string>): Record<string, string> {
  resetEnvCache();
  return { ...baseTestEnv, ...overrides };
}
