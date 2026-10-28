import * as cheerio from "cheerio";
import type { Env } from "../config/env.js";
import { ValidationError } from "../utils/errors.js";
import {
  assertSafeRedirectUrl,
  resolveAndValidateHost,
  validateUrlForFetch,
} from "../utils/url-safety.js";
import { normalizeWhitespace } from "../utils/text.js";

export interface WebLoadResult {
  title: string;
  text: string;
  canonicalUrl: string;
}

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return await response.text();
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > maxBytes) {
        throw new ValidationError("Response body exceeds size limit");
      }
      chunks.push(value);
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function loadWebPage(url: string, env: Env): Promise<WebLoadResult> {
  const initial = await validateUrlForFetch(url);

  // SSRF pipeline: validate URL → resolve DNS → fetch with redirect re-check per hop.
  let currentUrl = initial;
  let response: Response | null = null;
  const maxRedirects = 5;

  for (let i = 0; i <= maxRedirects; i++) {
    await resolveAndValidateHost(currentUrl.hostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);
    try {
      response = await fetch(currentUrl.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "RAG-Scraper/1.0 (+https://github.com/rag-scrapper)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new ValidationError("Redirect without location header");
      }
      const next = new URL(location, currentUrl);
      assertSafeRedirectUrl(next);
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new ValidationError("Redirect to unsupported protocol");
      }
      await resolveAndValidateHost(next.hostname);
      currentUrl = next;
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
    throw new ValidationError(`Failed to fetch URL: HTTP ${response?.status ?? "unknown"}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new ValidationError("URL did not return HTML content");
  }

  const html = await readBodyWithLimit(response, env.MAX_FETCH_BYTES);
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, iframe").remove();
  const title = $("title").first().text().trim() || currentUrl.hostname;
  const text = normalizeWhitespace($("body").text() || $.root().text());
  if (!text) {
    throw new ValidationError("No extractable text on page");
  }

  const canonical =
    $('link[rel="canonical"]').attr("href")?.trim() ||
    $('meta[property="og:url"]').attr("content")?.trim() ||
    currentUrl.toString();

  let canonicalUrl = currentUrl.toString();
  try {
    const resolved = new URL(canonical, currentUrl);
    if (resolved.protocol === "http:" || resolved.protocol === "https:") {
      canonicalUrl = resolved.toString();
    }
  } catch {
    // keep currentUrl
  }

  return { title, text, canonicalUrl };
}
