export interface ContextBlock {
  label: string;
  content: string;
}

export interface GenerationResult {
  answer: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface GenerationProvider {
  readonly providerId: "openai" | "gemini";
  readonly modelId: string;
  generateAnswer(question: string, contextBlocks: ContextBlock[]): Promise<GenerationResult>;
}
