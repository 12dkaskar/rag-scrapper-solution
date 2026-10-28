import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ingestUrlSchema, loadEnv, type RagContext, ValidationError } from "@rag-scrapper/core";
import { EnvConfigService } from "../config/env-config.service.js";
import { RAG_CONTEXT } from "../rag/rag.module.js";

function pdfMaxBytes(): number {
  return loadEnv().MAX_PDF_SIZE_MB * 1024 * 1024;
}

@Controller("api/ingest")
export class IngestController {
  constructor(
    @Inject(RAG_CONTEXT) private readonly ctx: RagContext,
    private readonly config: EnvConfigService,
  ) {}

  @Post("url")
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestUrl(@Body() body: unknown): Promise<{ documentId: string; status: string }> {
    const parsed = ingestUrlSchema.parse(body);
    return this.ctx.ingestion.ingestUrl(parsed.url);
  }

  @Post("pdf")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { files: 1, fileSize: pdfMaxBytes() },
    }),
  )
  async ingestPdf(@UploadedFile() file?: Express.Multer.File): Promise<{
    documentId: string;
    status: string;
  }> {
    const maxBytes = this.config.env.MAX_PDF_SIZE_MB * 1024 * 1024;
    if (!file) {
      throw new ValidationError("PDF file is required (field name: file)");
    }
    if (file.size > maxBytes) {
      throw new ValidationError(`PDF exceeds ${this.config.env.MAX_PDF_SIZE_MB}MB limit`);
    }
    const mime = file.mimetype;
    if (mime !== "application/pdf" && !file.originalname.toLowerCase().endsWith(".pdf")) {
      throw new ValidationError("Only PDF uploads are supported");
    }
    return this.ctx.ingestion.ingestPdf(file.buffer, file.originalname);
  }

  @Get(":documentId/status")
  getStatus(@Param("documentId") documentId: string): Promise<Record<string, unknown>> {
    return this.ctx.ingestion.getStatus(documentId);
  }
}
