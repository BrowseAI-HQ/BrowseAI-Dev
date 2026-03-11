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
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

const urlWithProtocol = z.string().transform((v) =>
  v.match(/^https?:\/\//) ? v : `https://${v}`
).pipe(z.string().url());

export const OpenRequestSchema = z.object({
  url: urlWithProtocol,
});

export const ExtractRequestSchema = z.object({
  url: urlWithProtocol,
  query: z.string().max(500).optional(),
});

export const AnswerRequestSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(["fast", "thorough"]).optional().default("fast"),
  sessionId: z.string().max(36).optional(),
});

// ── Research Memory schemas ──

export const CreateSessionSchema = z.object({
  name: z.string().min(1).max(100),
});

export const SessionAskSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(["fast", "thorough"]).optional().default("fast"),
});

export const RecallSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(50).optional().default(10),
});
