import { z } from "zod";

export const BrowseSourceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  domain: z.string(),
  quote: z.string(),
});

export const BrowseClaimSchema = z.object({
  claim: z.string(),
  sources: z.array(z.string()),
});

export const TraceStepSchema = z.object({
  step: z.string(),
  duration_ms: z.number(),
  detail: z.string().optional(),
});

export const BrowseResultSchema = z.object({
  answer: z.string(),
  claims: z.array(BrowseClaimSchema),
  sources: z.array(BrowseSourceSchema),
  confidence: z.number().min(0).max(1),
  trace: z.array(TraceStepSchema),
});

export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

export const OpenRequestSchema = z.object({
  url: z.string().url(),
});

export const ExtractRequestSchema = z.object({
  url: z.string().url(),
  query: z.string().optional(),
});

export const AnswerRequestSchema = z.object({
  query: z.string().min(1),
});
