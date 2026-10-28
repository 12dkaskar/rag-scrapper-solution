import type { Env } from "../config/env.js";
import type { GenerationProvider } from "../providers/generation/generation-provider.interface.js";
import type { RetrievedChunk, SourceReference } from "../types/domain.js";
import { RetrievalService } from "./retrieval.service.js";

const NO_CONTEXT_ANSWER =
  "The indexed sources do not contain enough information to answer this question. " +
  "Try ingesting more relevant documents or rephrasing your question. " +
  "Note: even when sources are found, generated answers may still be incorrect.";

export interface ChatResult {
  answer: string;
  sources: SourceReference[];
  retrieval: { topK: number; returnedChunks: number };
}

export class RagService {
  constructor(
    private readonly env: Env,
    private readonly retrieval: RetrievalService,
    private readonly generation: GenerationProvider,
  ) {}

  async chat(
    question: string,
    documentIds?: string[],
    topK?: number,
  ): Promise<ChatResult> {
    const k = topK ?? this.env.RAG_TOP_K;
    const { chunks, sources } = await this.retrieval.retrieve(question, k, documentIds);

    if (chunks.length === 0) {
      // Do not call the LLM when retrieval is empty — avoids fabricated grounding.
      return {
        answer: NO_CONTEXT_ANSWER,
        sources: [],
        retrieval: { topK: k, returnedChunks: 0 },
      };
    }

    const contextBlocks = this.buildContextBlocks(chunks);
    const { answer } = await this.generation.generateAnswer(question, contextBlocks);

    return {
      answer,
      sources,
      retrieval: { topK: k, returnedChunks: chunks.length },
    };
  }

  private buildContextBlocks(chunks: RetrievedChunk[]): { label: string; content: string }[] {
    const blocks: { label: string; content: string }[] = [];
    let used = 0;
    const max = this.env.MAX_CONTEXT_CHARS;

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const label = `[Source ${i + 1}: ${c.metadata.title}${c.metadata.pageNumber ? ` p.${c.metadata.pageNumber}` : ""}]`;
      const piece = `${label}\n${c.content}`;
      if (used + piece.length > max) {
        const remaining = max - used;
        if (remaining > 100) {
          blocks.push({ label, content: c.content.slice(0, remaining - label.length - 20) + "…" });
        }
        break;
      }
      blocks.push({ label, content: c.content });
      used += piece.length;
    }
    return blocks;
  }
}
