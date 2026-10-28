export type DocumentStatus = "pending" | "processing" | "completed" | "failed";
export type SourceType = "web" | "pdf";

export interface ChunkMetadata {
  sourceType: SourceType;
  sourceUrl: string | null;
  title: string;
  chunkIndex: number;
  pageNumber: number | null;
}

export interface RagDocumentRecord {
  documentId: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  title: string;
  status: DocumentStatus;
  chunkCount: number;
  contentHash: string | null;
  errorSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RagChunkRecord {
  documentId: string;
  content: string;
  embedding: number[];
  metadata: ChunkMetadata;
  embeddingModel: string;
  embeddingProvider: string;
  embeddingDimensions: number;
  createdAt: Date;
}

export interface RetrievedChunk {
  documentId: string;
  content: string;
  metadata: ChunkMetadata;
  score: number;
}

export interface SourceReference {
  documentId: string;
  title: string;
  sourceUrl: string | null;
  pageNumber: number | null;
  chunkIndex: number;
  score: number;
  excerpt: string;
}
