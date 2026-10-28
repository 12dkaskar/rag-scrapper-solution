import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ChatModule } from "./chat/chat.module.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { RequestIdMiddleware } from "./common/request-id.middleware.js";
import { EnvConfigModule } from "./config/env-config.module.js";
import { EnvConfigService } from "./config/env-config.service.js";
import { DatabaseModule } from "./database/database.module.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { HealthModule } from "./health/health.module.js";
import { IngestModule } from "./ingest/ingest.module.js";
import { RagModule } from "./rag/rag.module.js";

@Module({
  imports: [
    EnvConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [EnvConfigModule],
      inject: [EnvConfigService],
      useFactory: (config: EnvConfigService) => [
        {
          ttl: config.env.RATE_LIMIT_WINDOW_MS,
          limit: config.env.RATE_LIMIT_MAX,
        },
      ],
    }),
    DatabaseModule,
    RagModule,
    HealthModule,
    IngestModule,
    DocumentsModule,
    ChatModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
