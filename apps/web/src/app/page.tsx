"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  chat,
  deleteDocument,
  ingestPdf,
  ingestUrl,
  listDocuments,
  type ChatResponse,
  type DocumentItem,
} from "@/lib/api";

export default function HomePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [url, setUrl] = useState("https://en.wikipedia.org/wiki/Health_care");
  const [question, setQuestion] = useState("What are the main topics in the indexed sources?");
  const [chatResult, setChatResult] = useState<ChatResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await listDocuments();
    setDocuments(data.items);
  }, []);

  useEffect(() => {
    void refresh().catch((e: unknown) => {
      setError(e instanceof ApiError ? e.message : "Failed to load documents");
    });
  }, [refresh]);

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label);
    setError(null);
    try {
      return await fn();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? `${e.message} (${e.code})` : "Request failed");
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">RAG Scrapper</h1>
        <p className="mt-2 text-slate-400">
          Ingest URLs and PDFs, then ask questions grounded in your indexed sources.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-red-200">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <h2 className="text-lg font-medium">Ingest web page</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
          <button
            type="button"
            disabled={!!busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            onClick={() =>
              void run("url", async () => {
                await ingestUrl(url);
                await refresh();
              })
            }
          >
            {busy === "url" ? "Ingesting… (large pages can take 1–3 minutes)" : "Ingest URL"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <h2 className="text-lg font-medium">Ingest PDF</h2>
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={!!busy}
          className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-700 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-600"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void run("pdf", async () => {
              await ingestPdf(file);
              await refresh();
              e.target.value = "";
            });
          }}
        />
        {busy === "pdf" && (
          <p className="text-sm text-slate-400">Uploading and indexing… (large PDFs may take several minutes)</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Documents</h2>
          <button
            type="button"
            className="text-sm text-slate-400 hover:text-slate-200"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500">No documents yet. Ingest a URL or PDF above.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {documents.map((doc) => (
              <li key={doc.documentId} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(doc.documentId)}
                  onChange={() => toggleId(doc.documentId)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{doc.title || doc.documentId}</p>
                  <p className="text-slate-500">
                    {doc.sourceType} · {doc.status} · {doc.chunkCount} chunks
                  </p>
                </div>
                <button
                  type="button"
                  className="text-red-400 hover:text-red-300"
                  onClick={() =>
                    void run("delete", async () => {
                      await deleteDocument(doc.documentId);
                      setSelectedIds((prev) => prev.filter((id) => id !== doc.documentId));
                      await refresh();
                    })
                  }
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <h2 className="text-lg font-medium">Chat</h2>
        <textarea
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[100px]"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          {selectedIds.length > 0
            ? `Searching ${selectedIds.length} selected document(s).`
            : "No selection — search all indexed documents."}
        </p>
        <button
          type="button"
          disabled={!!busy || !question.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          onClick={() =>
            void run("chat", async () => {
              const result = await chat(
                question,
                selectedIds.length > 0 ? selectedIds : undefined,
              );
              setChatResult(result);
            })
          }
        >
          {busy === "chat" ? "Thinking…" : "Ask"}
        </button>

        {chatResult && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-slate-950/80 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {chatResult.answer}
            </div>
            {chatResult.sources.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Sources</h3>
                <ul className="space-y-2">
                  {chatResult.sources.map((s, i) => (
                    <li
                      key={`${s.documentId}-${s.chunkIndex}-${i}`}
                      className="rounded-lg border border-slate-800 p-3 text-xs text-slate-400"
                    >
                      <p className="text-slate-300 font-medium">
                        {s.title} · score {s.score.toFixed(3)}
                      </p>
                      <p className="mt-1">{s.excerpt}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
