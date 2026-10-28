import { Injectable } from "@nestjs/common";
import { loadEnv, type Env } from "@rag-scrapper/core";

@Injectable()
export class EnvConfigService {
  readonly env: Env = loadEnv();
}
