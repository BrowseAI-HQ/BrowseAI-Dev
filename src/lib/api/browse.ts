export type BrowseSource = {
  url: string;
  title: string;
  domain: string;
  quote: string;
  verified?: boolean;
  authority?: number;
  publishedDate?: string;
};

export type NLIScore = {
  entailment: number;
  contradiction: number;
  neutral: number;
  label: "entailment" | "neutral" | "contradiction";
};

export type BrowseClaim = {
  claim: string;
  sources: string[];
  verified?: boolean;
  verificationScore?: number;
  consensusCount?: number;
  consensusLevel?: "strong" | "moderate" | "weak" | "none";
  nliScore?: NLIScore;
};

export type Contradiction = {
  claimA: string;
  claimB: string;
  topic: string;
  nliConfidence?: number;
};

export type BrowseResult = {
  answer: string;
  claims: BrowseClaim[];
  sources: BrowseSource[];
  confidence: number;
  trace: {
    step: string;
    duration_ms: number;
    detail?: string;
  }[];
  shareId?: string;
  contradictions?: Contradiction[];
  reasoningSteps?: {
    step: number;
    query: string;
    gapAnalysis: string;
    claimCount: number;
    confidence: number;
  }[];
  effectiveDepth?: "fast" | "thorough" | "deep";
};

export type CompareProvider = "perplexity" | "tavily" | "exa" | "you" | "brave" | "raw_llm";

export type CompareCompetitorResult = {
  provider: CompareProvider;
  label: string;
  answer: string;
  sources: number;
  citations: { url: string; title: string }[];
  latency_ms: number;
};

export type CompareResult = {
  query: string;
  provider: CompareProvider;
  competitor: CompareCompetitorResult;
  evidence_backed: {
    answer: string;
    sources: number;
    claims: number;
    confidence: number;
    citations: BrowseSource[];
    claimDetails: BrowseClaim[];
    trace: { step: string; duration_ms: number; detail?: string }[];
    latency_ms: number;
  };
};

import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

async function apiCall<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  // UI never sends BYOK headers — users sign in (stored keys + premium) or use demo
  // BYOK still works for MCP/SDK/API packages
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `API call failed: ${res.status}`);
  }
  (window as any).posthog?.capture("browse_query", {
    tool: path,
  });
  return data.result;
}

export type QuotaInfo = {
  used: number;
  limit: number;
  premiumActive: boolean;
  resetsInSeconds?: number;
};

export async function browseKnowledge(
  query: string,
  depth: "fast" | "thorough" | "deep" = "fast",
): Promise<BrowseResult & { quota?: QuotaInfo }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/browse/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ query, depth }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `API call failed: ${res.status}`);
  }
  (window as any).posthog?.capture("browse_query", { tool: "/browse/answer" });
  return { ...data.result, ...(data.quota && { quota: data.quota }) };
}

export async function browseSearch(query: string, limit?: number) {
  return apiCall<{ results: any[]; cached: boolean }>("/browse/search", {
    query,
    limit,
  });
}

export async function browseOpen(url: string) {
  return apiCall<any>("/browse/open", { url });
}

export async function browseExtract(url: string, query?: string) {
  return apiCall<any>("/browse/extract", { url, query });
}

export async function browseCompare(query: string, provider: CompareProvider = "raw_llm"): Promise<CompareResult> {
  return apiCall<CompareResult>("/browse/compare", { query, provider });
}

export async function browseCompareProviders(): Promise<CompareProvider[]> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/browse/compare/providers`, { headers: authHeaders });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.result;
}

export async function browseFeedback(resultId: string, rating: "good" | "bad" | "wrong", claimIndex?: number) {
  return apiCall<{ message: string }>("/browse/feedback", {
    resultId,
    rating,
    ...(claimIndex !== undefined && { claimIndex }),
  });
}

export type ClarityClaim = {
  claim: string;
  origin: "llm" | "source" | "confirmed";
  sources: string[];
  verified?: boolean;
  verificationScore?: number;
};

export type ClarityResult = {
  original: string;
  intent: string;
  answer: string;
  claims: ClarityClaim[];
  sources: BrowseSource[];
  confidence: number;
  techniques: string[];
  risks: string[];
  verified: boolean;
  trace: { step: string; duration_ms: number; detail?: string }[];
  systemPrompt: string;
  userPrompt: string;
  contradictions?: Contradiction[];
};

export async function browseClarity(
  prompt: string,
  options?: { context?: string; intent?: string; verify?: boolean },
): Promise<ClarityResult> {
  return apiCall<ClarityResult>("/browse/clarity", {
    prompt,
    ...options,
  });
}

export async function browseStats(): Promise<{ totalQueries: number }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/browse/stats`, {
    headers: authHeaders,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.result;
}
