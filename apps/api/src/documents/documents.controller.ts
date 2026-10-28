import { Controller, Delete, Get, Inject, Param, Query } from "@nestjs/common";
import { listDocumentsQuerySchema, NotFoundError, type RagContext } from "@rag-scrapper/core";
import { RAG_CONTEXT } from "../rag/rag.module.js";

@Controller("api/documents")
export class DocumentsController {
  constructor(@Inject(RAG_CONTEXT) private readonly ctx: RagContext) {}

  @Get()
  async list(@Query() query: Record<string, unknown>): Promise<Record<string, unknown>> {
    const parsed = listDocumentsQuerySchema.parse(query);
    const { items, total } = await this.ctx.documents.list(parsed.page, parsed.limit);
    return {
      page: parsed.page,
      limit: parsed.limit,
      total,
      items: items.map((d) => ({
        documentId: d.documentId,
        sourceType: d.sourceType,
        sourceUrl: d.sourceUrl,
        title: d.title,
        status: d.status,
        chunkCount: d.chunkCount,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    };
  }

  @Delete(":documentId")
  async remove(@Param("documentId") documentId: string) {
    const deletedChunks = await this.ctx.chunks.deleteByDocumentId(documentId);
    const deletedDoc = await this.ctx.documents.delete(documentId);
    if (!deletedDoc) {
      throw new NotFoundError(`Document not found: ${documentId}`);
    }
    return { documentId, deleted: true, deletedChunks };
  }
}
