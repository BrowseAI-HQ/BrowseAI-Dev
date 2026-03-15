import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  throw new Error("Not authenticated");
}

async function authFetch(path: string, options: RequestInit = {}) {
  let token = await getAccessToken();

  const makeHeaders = (t: string): Record<string, string> => {
    const h: Record<string, string> = { Authorization: `Bearer ${t}` };
    if (options.body) h["Content-Type"] = "application/json";
    return h;
  };

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...makeHeaders(token), ...options.headers },
  });

  // On 401, refresh the session once and retry
  if (res.status === 401) {
    const { data: { session } } = await supabase.auth.refreshSession();
    if (session?.access_token) {
      token = session.access_token;
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...makeHeaders(token), ...options.headers },
      });
    }
  }

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

export async function sessionAsk(id: string, query: string, depth?: "fast" | "thorough" | "deep"): Promise<SessionAskResult> {
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

export async function forkSharedSession(shareId: string): Promise<{ session: Session; claimsForked: number }> {
  return authFetch(`/session/share/${shareId}/fork`, { method: "POST" });
}
