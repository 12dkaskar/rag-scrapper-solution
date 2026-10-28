import { describe, expect, it } from "vitest";
import { loadPdfFromBuffer, ValidationError } from "@rag-scrapper/core";

describe("loadPdfFromBuffer", () => {
  it("rejects non-PDF magic bytes", async () => {
    await expect(loadPdfFromBuffer(Buffer.from("not a pdf"), "x.pdf", 10)).rejects.toThrow(
      ValidationError,
    );
  });

  it("rejects empty buffer", async () => {
    await expect(loadPdfFromBuffer(Buffer.alloc(0), "x.pdf", 10)).rejects.toThrow(ValidationError);
  });
});
