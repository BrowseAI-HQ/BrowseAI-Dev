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
  trace: {
    step: string;
    duration_ms: number;
    detail?: string;
  }[];
  shareId?: string;
  contradictions?: Contradiction[];
};

export type CompareResult = {
  query: string;
  raw_llm: {
    answer: string;
    sources: number;
    claims: number;
    confidence: null;
  };
  evidence_backed: {
    answer: string;
    sources: number;
    claims: number;
    confidence: number;
    citations: BrowseSource[];
    claimDetails: BrowseClaim[];
    trace: { step: string; duration_ms: number; detail?: string }[];
  };
};

import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function getUserKeyHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const tavily = localStorage.getItem("browse_tavily_key");
  const openrouter = localStorage.getItem("browse_openrouter_key");
  if (tavily) headers["X-Tavily-Key"] = tavily;
  if (openrouter) headers["X-OpenRouter-Key"] = openrouter;
  return headers;
}

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
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getUserKeyHeaders(), ...authHeaders },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `API call failed: ${res.status}`);
  }
  (window as any).posthog?.capture("browse_query", {
    tool: path,
    byok: !!localStorage.getItem("browse_tavily_key"),
  });
  return data.result;
}

export async function browseKnowledge(query: string): Promise<BrowseResult> {
  return apiCall<BrowseResult>("/browse/answer", { query });
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

export async function browseCompare(query: string): Promise<CompareResult> {
  return apiCall<CompareResult>("/browse/compare", { query });
}

export async function browseStats(): Promise<{ totalQueries: number }> {
  const res = await fetch(`${API_BASE}/browse/stats`, {
    headers: getUserKeyHeaders(),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.result;
}
