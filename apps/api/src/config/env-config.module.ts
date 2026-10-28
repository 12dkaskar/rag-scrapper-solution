import { Global, Module } from "@nestjs/common";
import { EnvConfigService } from "./env-config.service.js";

@Global()
@Module({
  providers: [EnvConfigService],
  exports: [EnvConfigService],
})
export class EnvConfigModule {}
