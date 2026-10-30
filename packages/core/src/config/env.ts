import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { z } from "zod";

let envFileLoaded = false;

function resolveDotEnvPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(here, "../../../../.env"),
    resolve(here, "../../../.env"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return resolve(process.cwd(), ".env");
}

function loadEnvFileFromCwd(): void {
  if (envFileLoaded) return;
  envFileLoaded = true;
  const path = resolveDotEnvPath();
  if (existsSync(path)) {
    loadEnvFile(path);
  }
}

const providerEnum = z.enum(["openai", "gemini"]);

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  ELASTICSEARCH_URL: z.string().min(1, "ELASTICSEARCH_URL is required"),
  ELASTICSEARCH_API_KEY: z.string().min(1, "ELASTICSEARCH_API_KEY is required"),
  ELASTICSEARCH_CHUNKS_INDEX: z.string().min(1).default("rag_chunks"),
  ELASTICSEARCH_DOCUMENTS_INDEX: z.string().min(1).default("rag_documents"),
  EMBEDDING_PROVIDER: providerEnum.default("gemini"),
  EMBEDDING_MODEL: z.string().min(1),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive(),
  /** Parallel embed calls per batch (keep low on Gemini free tier). */
  EMBED_CONCURRENCY: z.coerce.number().int().positive().max(4).default(2),
  /** Pause between embed batches to stay under Gemini embed RPM quotas. */
  EMBED_MIN_INTERVAL_MS: z.coerce.number().int().nonnegative().default(650),
  GENERATION_PROVIDER: providerEnum.default("gemini"),
  GENERATION_MODEL: z.string().min(1),
  CHUNK_SIZE: z.coerce.number().int().positive().default(1200),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(100),
  RAG_TOP_K: z.coerce.number().int().positive().max(50).default(5),
  MAX_CONTEXT_CHARS: z.coerce.number().int().positive().default(18000),
  MAX_PDF_SIZE_MB: z.coerce.number().positive().default(10),
  MAX_FETCH_BYTES: z.coerce.number().int().positive().default(5_242_880),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof baseSchema>;

function validateProviderKeys(data: Env): void {
  const missing: string[] = [];
  if (data.EMBEDDING_PROVIDER === "openai" && !data.OPENAI_API_KEY) {
    missing.push("OPENAI_API_KEY");
  }
  if (data.EMBEDDING_PROVIDER === "gemini" && !data.GEMINI_API_KEY) {
    missing.push("GEMINI_API_KEY");
  }
  if (data.GENERATION_PROVIDER === "openai" && !data.OPENAI_API_KEY) {
    missing.push("OPENAI_API_KEY");
  }
  if (data.GENERATION_PROVIDER === "gemini" && !data.GEMINI_API_KEY) {
    missing.push("GEMINI_API_KEY");
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for selected providers: ${[...new Set(missing)].join(", ")}`,
    );
  }
}

let cached: Env | null = null;

export function loadEnv(overrides?: Record<string, string>): Env {
  if (cached && !overrides) {
    return cached;
  }
  if (!overrides) {
    loadEnvFileFromCwd();
  }
  const source = { ...process.env, ...overrides };
  const parsed = baseSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".") || i.message);
    throw new Error(`Invalid environment configuration: ${fields.join("; ")}`);
  }
  validateProviderKeys(parsed.data);
  if (!overrides) {
    cached = parsed.data;
  }
  return parsed.data;
}

export function resetEnvCache(): void {
  cached = null;
  envFileLoaded = false;
}

export function getCorsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
}
