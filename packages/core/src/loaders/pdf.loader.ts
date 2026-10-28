import { PDFParse } from "pdf-parse";
import { ValidationError } from "../utils/errors.js";
import { normalizeWhitespace } from "../utils/text.js";

export interface PdfPageText {
  pageNumber: number;
  text: string;
}

export interface PdfLoadResult {
  title: string;
  pages: PdfPageText[];
  fullText: string;
}

function assertPdfMagic(buffer: Buffer): void {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new ValidationError("File is not a valid PDF (missing %PDF- header)");
  }
}

export async function loadPdfFromBuffer(
  buffer: Buffer,
  originalName: string,
  maxSizeMb: number,
): Promise<PdfLoadResult> {
  const maxBytes = maxSizeMb * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new ValidationError(`PDF exceeds maximum size of ${maxSizeMb} MB`);
  }
  if (buffer.length === 0) {
    throw new ValidationError("Empty PDF file");
  }
  assertPdfMagic(buffer);

  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    const textResult = await parser.getText();
    const fullText = normalizeWhitespace(textResult.text ?? "");
    if (!fullText) {
      throw new ValidationError("PDF contains no extractable text (OCR not supported)");
    }

    const title =
      (info.info?.Title && String(info.info.Title).trim()) ||
      originalName.replace(/\.pdf$/i, "") ||
      "Uploaded PDF";

    const pages: PdfPageText[] = textResult.pages
      .map((p) => ({
        pageNumber: p.num,
        text: normalizeWhitespace(p.text),
      }))
      .filter((p) => p.text.length > 0);

    if (pages.length === 0) {
      pages.push({ pageNumber: 1, text: fullText });
    }

    return { title, pages, fullText };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(
      "Could not parse PDF (encrypted, malformed, or image-only content)",
    );
  } finally {
    await parser.destroy();
  }
}
