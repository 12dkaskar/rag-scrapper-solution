import type { Env } from "./config/env.js";
import { ChunksRepository } from "./db/repositories/chunks.repository.js";
import { DocumentsRepository } from "./db/repositories/documents.repository.js";
import { createEmbeddingProvider } from "./providers/embeddings/index.js";
import { createGenerationProvider } from "./providers/generation/index.js";
import { ChunkingService } from "./services/chunking.service.js";
import { IngestionService } from "./services/ingestion.service.js";
import { RagService } from "./services/rag.service.js";
import { RetrievalService } from "./services/retrieval.service.js";

export interface RagContext {
  env: Env;
  documents: DocumentsRepository;
  chunks: ChunksRepository;
  ingestion: IngestionService;
  rag: RagService;
}

export function createRagContext(env: Env): RagContext {
  const embedding = createEmbeddingProvider(env);
  const generation = createGenerationProvider(env);
  const documents = new DocumentsRepository(env);
  const chunks = new ChunksRepository(env);
  const chunking = new ChunkingService(env);
  const ingestion = new IngestionService(env, documents, chunks, embedding, chunking);
  const retrieval = new RetrievalService(env, chunks, embedding);
  const rag = new RagService(env, retrieval, generation);

  return { env, documents, chunks, ingestion, rag };
}
