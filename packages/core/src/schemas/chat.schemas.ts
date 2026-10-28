import { z } from "zod";

export const chatRequestSchema = z.object({
  question: z.string().min(1).max(4000),
  documentIds: z.array(z.string().uuid()).optional(),
  topK: z.number().int().positive().max(50).optional(),
});
