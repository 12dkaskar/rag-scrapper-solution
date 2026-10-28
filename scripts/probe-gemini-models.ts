import { GoogleGenAI } from "@google/genai";
import { loadEnv } from "@rag-scrapper/core";

const candidates = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-2.5-flash",
    ];

async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY missing");
    process.exit(1);
  }
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  for (const model of candidates) {
    try {
      const r = await client.models.generateContent({
        model,
        contents: "Reply with exactly: ok",
      });
      console.log("OK", model, "->", (r.text ?? "").trim().slice(0, 40));
    } catch (e) {
      const raw = String(e);
      const match = raw.match(/"message":"([^"]+)"/);
      console.log("FAIL", model, "->", match?.[1] ?? raw.slice(0, 100));
    }
  }
}

main();
