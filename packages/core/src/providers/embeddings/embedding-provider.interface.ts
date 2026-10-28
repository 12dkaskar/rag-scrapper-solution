export interface EmbeddingProvider {
  readonly providerId: "openai" | "gemini";
  readonly modelId: string;
  readonly dimensions: number;
  embedTexts(texts: string[]): Promise<number[][]>;
}
