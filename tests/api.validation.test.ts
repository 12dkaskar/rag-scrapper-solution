import { describe, expect, it } from "vitest";
import { chatRequestSchema } from "@rag-scrapper/core";
import { HealthController } from "../apps/api/src/health/health.controller.js";

describe("API validation", () => {
  it("rejects empty chat question", () => {
    const result = chatRequestSchema.safeParse({ question: "" });
    expect(result.success).toBe(false);
  });

  it("health endpoint returns ok", () => {
    const controller = new HealthController();
    expect(controller.health()).toEqual({ status: "ok" });
  });
});
