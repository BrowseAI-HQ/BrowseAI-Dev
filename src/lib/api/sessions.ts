import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function authFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `API call failed: ${res.status}`);
  }
  return data.result;
}

export interface Session {
  id: string;
  name: string;
  userId: string | null;
  claimCount: number;
  queryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEntry {
  id: string;
  sessionId: string;
  claim: string;
  sources: string[];
  verified: boolean;
  confidence: number;
  originQuery: string;
  createdAt: string;
}

export interface SessionAskResult {
  answer: string;
  claims: Array<{ claim: string; sources: string[]; verified?: boolean; verificationScore?: number; consensusLevel?: string }>;
  sources: Array<{ url: string; title: string; domain: string; quote: string }>;
  confidence: number;
  trace: Array<{ step: string; duration_ms: number; detail: string }>;
  session: {
    id: string;
    name: string;
    recalledClaims: number;
    newClaimsStored: number;
  };
}

export async function createSession(name: string): Promise<Session> {
  return authFetch("/session", { method: "POST", body: JSON.stringify({ name }) });
}

export async function listSessions(): Promise<Session[]> {
  return authFetch("/sessions");
}

export async function getSession(id: string): Promise<Session> {
  return authFetch(`/session/${id}`);
}

export async function deleteSession(id: string): Promise<void> {
  return authFetch(`/session/${id}`, { method: "DELETE" });
}

export async function sessionAsk(id: string, query: string, depth?: "fast" | "thorough"): Promise<SessionAskResult> {
  return authFetch(`/session/${id}/ask`, {
    method: "POST",
    body: JSON.stringify({ query, ...(depth && { depth }) }),
  });
}

export async function getSessionKnowledge(id: string, limit = 50): Promise<{ entries: KnowledgeEntry[]; count: number }> {
  return authFetch(`/session/${id}/knowledge?limit=${limit}`);
}

export async function shareSession(id: string): Promise<{ shareId: string }> {
  return authFetch(`/session/${id}/share`, { method: "POST" });
}

// Public (no auth) — for the shared session page
export async function getSharedSession(shareId: string): Promise<{
  session: { name: string; claimCount: number; queryCount: number };
  entries: KnowledgeEntry[];
}> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
  const res = await fetch(`${API_BASE_URL}/session/share/${shareId}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load shared session");
  }
  return data.result;
}
