export type BrowseSource = {
  url: string;
  title: string;
  domain: string;
  quote: string;
  verified?: boolean;
  authority?: number;
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

export type BrowseResult = {
  answer: string;
  claims: BrowseClaim[];
  sources: BrowseSource[];
  confidence: number;
  trace: TraceStep[];
  contradictions?: Contradiction[];
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
  depth?: "fast" | "thorough";
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
  depth?: "fast" | "thorough";
};

export type RecallRequest = {
  query: string;
  limit?: number;
};

// ── Feedback ──

export type FeedbackRequest = {
  resultId: string;
  rating: "good" | "bad" | "wrong";
  claimIndex?: number;
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
  | { success: true; result: T; quota?: PremiumQuota }
  | { success: false; error: string };
