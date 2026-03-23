export type BrowseSource = {
  url: string;
  title: string;
  domain: string;
  quote: string;
  verified?: boolean;
  authority?: number;
  /** ISO date (YYYY-MM-DD) when the source was published. null if unknown. */
  publishedDate?: string;
};

export type NLIScore = {
  /** Probability that evidence supports this claim */
  entailment: number;
  /** Probability that evidence contradicts this claim */
  contradiction: number;
  /** Probability that evidence is unrelated */
  neutral: number;
  /** Winning label */
  label: "entailment" | "neutral" | "contradiction";
};

export type BrowseClaim = {
  claim: string;
  sources: string[];
  verified?: boolean;
  verificationScore?: number;
  consensusCount?: number;
  consensusLevel?: "strong" | "moderate" | "weak" | "none";
  /** NLI semantic entailment score (when available) */
  nliScore?: NLIScore;
};

export type TraceStep = {
  step: string;
  duration_ms: number;
  detail?: string;
};

export type Contradiction = {
  claimA: string;
  claimB: string;
  topic: string;
  /** NLI contradiction confidence (0-1) when available */
  nliConfidence?: number;
};

export type ReasoningStep = {
  step: number;
  query: string;
  gapAnalysis: string;
  claimCount: number;
  confidence: number;
};

export type BrowseResult = {
  answer: string;
  claims: BrowseClaim[];
  sources: BrowseSource[];
  confidence: number;
  trace: TraceStep[];
  contradictions?: Contradiction[];
  /** Multi-step reasoning steps (deep mode only) */
  reasoningSteps?: ReasoningStep[];
  shareId?: string;
  effectiveDepth?: "fast" | "thorough" | "deep";
};

export type SearchRequest = {
  query: string;
  limit?: number;
};

export type OpenRequest = {
  url: string;
};

export type ExtractRequest = {
  url: string;
  query?: string;
};

export type AnswerRequest = {
  query: string;
  depth?: "fast" | "thorough" | "deep";
  sessionId?: string;
  searchProvider?: SearchProviderConfig;
};

// ── Search Provider (Enterprise) ──

export type SearchProviderConfig = {
  /** Provider type: internet (tavily/brave) or enterprise (elasticsearch/confluence/custom) */
  type: "tavily" | "brave" | "elasticsearch" | "confluence" | "custom";
  /** Endpoint URL (for enterprise providers) */
  endpoint?: string;
  /** Auth header value (e.g. "Bearer xxx" or "Basic xxx") */
  authHeader?: string;
  /** Elasticsearch index name */
  index?: string;
  /** Confluence space key */
  spaceKey?: string;
  /** Data retention mode — "none" skips all caching and storage */
  dataRetention?: "normal" | "none";
};

// ── Research Memory ──

export type Session = {
  id: string;
  name: string;
  userId?: string;
  claimCount: number;
  queryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeEntry = {
  id: string;
  sessionId: string;
  claim: string;
  sources: string[];
  verified: boolean;
  confidence: number;
  originQuery: string;
  createdAt: string;
};

export type SessionAskRequest = {
  query: string;
  depth?: "fast" | "thorough" | "deep";
};

export type RecallRequest = {
  query: string;
  limit?: number;
};

// ── Clarity (Anti-Hallucination) ──

export type ClarityIntent = "factual_question" | "document_qa" | "content_generation" | "agent_pipeline" | "code_generation" | "general";

export type ClarityTechnique =
  | "uncertainty_permission"
  | "direct_quote_grounding"
  | "citation_then_verify"
  | "chain_of_verification"
  | "step_back_abstraction"
  | "source_attribution"
  | "external_knowledge_restriction";

export type ClarityRequest = {
  prompt: string;
  /** Optional context documents to ground the prompt against */
  context?: string;
  /** Force a specific intent instead of auto-detecting */
  intent?: ClarityIntent;
  /** Whether to also verify the output via browse_answer after generation */
  verify?: boolean;
};

export type ClarityResult = {
  /** The original prompt */
  original: string;
  /** Auto-detected or user-specified intent */
  intent: ClarityIntent;
  /** Clarity system prompt with anti-hallucination techniques baked in */
  systemPrompt: string;
  /** Clarity user prompt (rewritten for factual grounding) */
  userPrompt: string;
  /** Which techniques were applied */
  techniques: ClarityTechnique[];
  /** Optional: verification result if verify=true was set */
  verification?: BrowseResult;
};

// ── Feedback ──

export type FeedbackRequest = {
  resultId: string;
  rating: "good" | "bad" | "wrong";
  claimIndex?: number;
};

// ── Compare ──

export type CompareProvider = "perplexity" | "tavily" | "exa" | "you" | "brave" | "raw_llm";

export type CompareRequest = {
  query: string;
  provider?: CompareProvider;
};

export type CompareCompetitorResult = {
  provider: CompareProvider;
  label: string;
  answer: string;
  sources: number;
  citations: { url: string; title: string }[];
  latency_ms: number;
};

// ── Premium Quota ──

export type PremiumQuota = {
  /** Number of premium queries used in current period */
  used: number;
  /** Maximum premium queries allowed per period */
  limit: number;
  /** Whether premium features (NLI, multi-provider) are currently active */
  premiumActive: boolean;
};

export type ApiResponse<T> =
  | { success: true; result: T; quota?: PremiumQuota; disclaimer?: string }
  | { success: false; error: string };
