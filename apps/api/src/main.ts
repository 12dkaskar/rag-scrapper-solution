import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { connectMongo, getCorsOrigins, loadEnv } from "@rag-scrapper/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  await connectMongo(env);
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  const origins = getCorsOrigins(env);
  app.enableCors({
    origin: origins.length === 1 && origins[0] === "*" ? true : origins,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
  });
  await app.listen(env.PORT);
  console.log(`API listening on http://localhost:${env.PORT}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
