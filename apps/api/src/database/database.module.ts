import { Global, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { closeElasticsearch, ensureElasticIndices } from "@rag-scrapper/core";
import { EnvConfigService } from "../config/env-config.service.js";

@Global()
@Module({})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: EnvConfigService) {}

  async onModuleInit(): Promise<void> {
    await ensureElasticIndices(this.config.env);
  }

  async onModuleDestroy(): Promise<void> {
    await closeElasticsearch();
  }
}
