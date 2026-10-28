import { Global, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  ChunksRepository,
  closeMongo,
  connectMongo,
  DocumentsRepository,
} from "@rag-scrapper/core";
import { EnvConfigService } from "../config/env-config.service.js";

@Global()
@Module({})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: EnvConfigService) {}

  async onModuleInit(): Promise<void> {
    await connectMongo(this.config.env);
    const documents = new DocumentsRepository(this.config.env);
    const chunks = new ChunksRepository(this.config.env);
    await documents.ensureIndexes();
    await chunks.ensureIndexes();
  }

  async onModuleDestroy(): Promise<void> {
    await closeMongo();
  }
}
