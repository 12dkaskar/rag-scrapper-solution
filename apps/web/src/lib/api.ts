export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await parseJson<ApiErrorBody>(res).catch(() => null);
    throw new ApiError(
      body?.error?.message ?? res.statusText,
      body?.error?.code ?? "HTTP_ERROR",
      body?.error?.requestId,
    );
  }
  return parseJson<T>(res);
}

export interface DocumentItem {
  documentId: string;
  sourceType: string;
  sourceUrl: string | null;
  title: string;
  status: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentsResponse {
  page: number;
  limit: number;
  total: number;
  items: DocumentItem[];
}

export interface IngestResponse {
  documentId: string;
  status: string;
}

export interface ChatSource {
  documentId: string;
  title: string;
  sourceUrl: string | null;
  pageNumber: number | null;
  chunkIndex: number;
  score: number;
  excerpt: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  retrieval: { topK: number; returnedChunks: number };
}

export function listDocuments(page = 1, limit = 20) {
  return apiFetch<DocumentsResponse>(`/api/documents?page=${page}&limit=${limit}`);
}

export function ingestUrl(url: string) {
  return apiFetch<IngestResponse>("/api/ingest/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export function ingestPdf(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<IngestResponse>("/api/ingest/pdf", { method: "POST", body: form });
}

export function chat(question: string, documentIds?: string[], topK = 5) {
  return apiFetch<ChatResponse>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, documentIds, topK }),
  });
}

export function deleteDocument(documentId: string) {
  return apiFetch<{ documentId: string; deleted: boolean; deletedChunks: number }>(
    `/api/documents/${documentId}`,
    { method: "DELETE" },
  );
}
