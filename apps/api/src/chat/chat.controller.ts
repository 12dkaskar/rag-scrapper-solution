import { Body, Controller, Inject, Post } from "@nestjs/common";
import { chatRequestSchema, type ChatResult, type RagContext } from "@rag-scrapper/core";
import { RAG_CONTEXT } from "../rag/rag.module.js";

@Controller("api/chat")
export class ChatController {
  constructor(@Inject(RAG_CONTEXT) private readonly ctx: RagContext) {}

  @Post()
  chat(@Body() body: unknown): Promise<ChatResult> {
    const parsed = chatRequestSchema.parse(body);
    return this.ctx.rag.chat(parsed.question, parsed.documentIds, parsed.topK);
  }
}
