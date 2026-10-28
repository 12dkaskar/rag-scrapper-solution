import { describe, expect, it } from "vitest";
import { assertSafeUrlString, resolveAndValidateHost, ValidationError } from "@rag-scrapper/core";

describe("url-safety", () => {
  it("rejects non-http schemes", () => {
    expect(() => assertSafeUrlString("file:///etc/passwd")).toThrow(ValidationError);
  });

  it("rejects localhost hostnames", () => {
    expect(() => assertSafeUrlString("http://localhost/admin")).toThrow(ValidationError);
  });

  it("rejects private IP literals", async () => {
    await expect(resolveAndValidateHost("127.0.0.1")).rejects.toThrow(ValidationError);
    await expect(resolveAndValidateHost("10.0.0.1")).rejects.toThrow(ValidationError);
  });

  it("allows public hostnames", async () => {
    await expect(resolveAndValidateHost("example.com")).resolves.toBeUndefined();
  });
});
