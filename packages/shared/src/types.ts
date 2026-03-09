export type BrowseSource = {
  url: string;
  title: string;
  domain: string;
  quote: string;
};

export type BrowseClaim = {
  claim: string;
  sources: string[];
};

export type TraceStep = {
  step: string;
  duration_ms: number;
  detail?: string;
};

export type BrowseResult = {
  answer: string;
  claims: BrowseClaim[];
  sources: BrowseSource[];
  confidence: number;
  trace: TraceStep[];
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
