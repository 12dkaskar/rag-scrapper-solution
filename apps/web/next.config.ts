import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const apiInternal = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Read MAX_PDF_SIZE_MB from repo-root .env so Next proxy limits match the API. */
function maxUploadBodySize(): string {
  const envPath = resolve(repoRoot, ".env");
  let mb = 15;
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, "utf8").match(/^MAX_PDF_SIZE_MB=(\d+(?:\.\d+)?)/m);
    if (match) {
      mb = Math.ceil(Number(match[1]) + 3);
    }
  }
  return `${mb}mb`;
}

const nextConfig: NextConfig = {
  experimental: {
    // Large PDFs + long embed/ingest (ebooks can exceed 5 minutes).
    proxyTimeout: 900_000,
    // Rewrites clone the request body; default is 10MB (truncates uploads to the API).
    middlewareClientMaxBodySize: maxUploadBodySize(),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternal}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${apiInternal}/health`,
      },
      {
        source: "/ready",
        destination: `${apiInternal}/ready`,
      },
    ];
  },
};

export default nextConfig;
