export type BrowseSource = {
  url: string;
  title: string;
  domain: string;
  quote: string;
  verified?: boolean;
  authority?: number;
};

export type BrowseClaim = {
  claim: string;
  sources: string[];
  verified?: boolean;
  verificationScore?: number;
  consensusCount?: number;
  consensusLevel?: "strong" | "moderate" | "weak" | "none";
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
};

export type ApiResponse<T> =
  | { success: true; result: T }
  | { success: false; error: string };
