import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Env } from "../config/env.js";
import type { ChunkMetadata, SourceType } from "../types/domain.js";

export interface TextSegment {
  text: string;
  pageNumber: number | null;
}

export interface ChunkOutput {
  content: string;
  metadata: ChunkMetadata;
}

export class ChunkingService {
  private splitter: RecursiveCharacterTextSplitter;

  constructor(env: Env) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: env.CHUNK_SIZE,
      chunkOverlap: env.CHUNK_OVERLAP,
    });
  }

  async chunkSegments(
    segments: TextSegment[],
    base: Omit<ChunkMetadata, "chunkIndex" | "pageNumber">,
  ): Promise<ChunkOutput[]> {
    const outputs: ChunkOutput[] = [];
    let globalIndex = 0;
    for (const segment of segments) {
      const parts = await this.splitter.splitText(segment.text);
      for (const part of parts) {
        outputs.push({
          content: part,
          metadata: {
            ...base,
            chunkIndex: globalIndex,
            pageNumber: segment.pageNumber,
          },
        });
        globalIndex += 1;
      }
    }
    return outputs;
  }

  async chunkPlainText(
    text: string,
    sourceType: SourceType,
    sourceUrl: string | null,
    title: string,
    pageNumber: number | null = null,
  ): Promise<ChunkOutput[]> {
    return this.chunkSegments([{ text, pageNumber }], {
      sourceType,
      sourceUrl,
      title,
    });
  }
}
