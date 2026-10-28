import { Global, Module } from "@nestjs/common";
import { createRagContext, type RagContext } from "@rag-scrapper/core";
import { EnvConfigService } from "../config/env-config.service.js";

export const RAG_CONTEXT = Symbol("RAG_CONTEXT");

@Global()
@Module({
  providers: [
    {
      provide: RAG_CONTEXT,
      inject: [EnvConfigService],
      useFactory: (config: EnvConfigService): RagContext => createRagContext(config.env),
    },
  ],
  exports: [RAG_CONTEXT],
})
export class RagModule {}
