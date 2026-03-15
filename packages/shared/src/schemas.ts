import { z } from "zod";

export const BrowseSourceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  domain: z.string(),
  quote: z.string(),
  verified: z.boolean().optional(),
  authority: z.number().min(0).max(1).optional(),
});

export const NLIScoreSchema = z.object({
  entailment: z.number(),
  contradiction: z.number(),
  neutral: z.number(),
  label: z.enum(["entailment", "neutral", "contradiction"]),
});

export const BrowseClaimSchema = z.object({
  claim: z.string(),
  sources: z.array(z.string()),
  verified: z.boolean().optional(),
  verificationScore: z.number().min(0).max(1).optional(),
  consensusCount: z.number().int().optional(),
  consensusLevel: z.enum(["strong", "moderate", "weak", "none"]).optional(),
  nliScore: NLIScoreSchema.optional(),
});

export const TraceStepSchema = z.object({
  step: z.string(),
  duration_ms: z.number(),
  detail: z.string().optional(),
});

export const ContradictionSchema = z.object({
  claimA: z.string(),
  claimB: z.string(),
  topic: z.string(),
  nliConfidence: z.number().min(0).max(1).optional(),
});

export const BrowseResultSchema = z.object({
  answer: z.string(),
  claims: z.array(BrowseClaimSchema),
  sources: z.array(BrowseSourceSchema),
  confidence: z.number().min(0).max(1),
  trace: z.array(TraceStepSchema),
  contradictions: z.array(ContradictionSchema).optional(),
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

// ── Search Provider schema (Enterprise) ──

export const SearchProviderConfigSchema = z.object({
  type: z.enum(["tavily", "brave", "elasticsearch", "confluence", "custom"]),
  endpoint: z.string().url().optional(),
  authHeader: z.string().max(2000).optional(),
  index: z.string().max(200).optional(),
  spaceKey: z.string().max(200).optional(),
  dataRetention: z.enum(["normal", "none"]).optional().default("normal"),
});

export const AnswerRequestSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(["fast", "thorough"]).optional().default("fast"),
  sessionId: z.string().max(36).optional(),
  searchProvider: SearchProviderConfigSchema.optional(),
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

// ── Premium Quota schema ──

export const PremiumQuotaSchema = z.object({
  used: z.number().int().min(0),
  limit: z.number().int().min(0),
  premiumActive: z.boolean(),
});

// ── Feedback schema ──

export const FeedbackRequestSchema = z.object({
  resultId: z.string().min(1).max(36),
  rating: z.enum(["good", "bad", "wrong"]),
  claimIndex: z.number().int().min(0).optional(),
});
