import { describe, expect, it } from "vitest";
import { loadEnv, resetEnvCache } from "@rag-scrapper/core";
import { withTestEnv } from "./helpers/test-env.js";

describe("loadEnv", () => {
  it("loads valid gemini configuration", () => {
    const env = loadEnv(withTestEnv());
    expect(env.EMBEDDING_PROVIDER).toBe("gemini");
    expect(env.EMBEDDING_DIMENSIONS).toBe(768);
  });

  it("requires OPENAI_API_KEY when openai embedding is selected", () => {
    resetEnvCache();
    expect(() =>
      loadEnv(
        withTestEnv({
          EMBEDDING_PROVIDER: "openai",
          EMBEDDING_MODEL: "text-embedding-3-small",
          EMBEDDING_DIMENSIONS: "1536",
          OPENAI_API_KEY: "",
        }),
      ),
    ).toThrow(/OPENAI_API_KEY/);
  });

  it("reports missing ELASTICSEARCH_URL without exposing values", () => {
    resetEnvCache();
    expect(() => loadEnv(withTestEnv({ ELASTICSEARCH_URL: "" }))).toThrow(/ELASTICSEARCH_URL/);
  });
});
