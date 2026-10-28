import { z } from "zod";

export const ingestUrlSchema = z.object({
  url: z.string().url().max(2048),
});

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
