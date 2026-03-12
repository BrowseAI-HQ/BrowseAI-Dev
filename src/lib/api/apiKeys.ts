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

export interface ApiKeyRecord {
  id: string;
  api_key_prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
}

export interface CreateApiKeyResult extends ApiKeyRecord {
  apiKey: string;
}

export async function createApiKey(
  tavilyKey: string,
  openrouterKey: string,
  label?: string
): Promise<CreateApiKeyResult> {
  return authFetch("/api-keys", {
    method: "POST",
    body: JSON.stringify({ tavily_key: tavilyKey, openrouter_key: openrouterKey, label }),
  });
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  return authFetch("/api-keys");
}

export async function revokeApiKey(id: string): Promise<void> {
  return authFetch(`/api-keys/${id}`, { method: "DELETE" });
}

// User stats & history

export interface UserStats {
  totalQueries: number;
  thisMonth: number;
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  tool: string;
  created_at: string;
}

export async function fetchUserStats(): Promise<UserStats> {
  return authFetch("/user/stats");
}

export async function fetchUserHistory(): Promise<QueryHistoryItem[]> {
  return authFetch("/user/history");
}

// Admin: waitlist

export interface WaitlistEntry {
  id: string;
  email: string;
  source: string;
  created_at: string;
}

export async function fetchWaitlist(): Promise<{ entries: WaitlistEntry[]; total: number }> {
  return authFetch("/waitlist");
}

export async function checkWaitlistStatus(): Promise<{ onWaitlist: boolean; isAdmin: boolean }> {
  return authFetch("/waitlist/status");
}

// Admin

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface AdminMetrics {
  totalQueries: number;
  queriesToday: number;
  avgConfidence: number | null;
  avgResponseTimeMs: number | null;
  cacheHitRate: number | null;
  waitlistCount: number;
  admins: { id: string; email: string; created_at: string }[];
  clientBreakdown: { client: string; count: number }[];
  users: AdminUser[];
  totalUsers: number;
  packageStats: {
    npm: { weeklyDownloads: number; totalDownloads: number } | null;
    pypi: { weeklyDownloads: number; totalDownloads: number } | null;
    github: { stars: number; forks: number; openIssues: number } | null;
  };
}

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  return authFetch("/admin/metrics");
}

export async function addAdmin(email: string): Promise<{ message: string }> {
  return authFetch("/admin/admins", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function removeAdmin(email: string): Promise<{ message: string }> {
  return authFetch(`/admin/admins/${encodeURIComponent(email)}`, {
    method: "DELETE",
  });
}

// Domain authority admin actions

export interface ImportDomainResult {
  parsed: number;
  savedToDB: number;
  loadedToMemory: number;
  sampleDomains: { domain: string; rank: number; score: number }[];
}

export interface RecalculateResult {
  domainsUpdated: number;
  persistedToDB: boolean;
  topDomains: { domain: string; score: number; samples: number }[];
}

export async function importDomainData(limit = 10000): Promise<ImportDomainResult> {
  return authFetch("/admin/import-domain-data", {
    method: "POST",
    body: JSON.stringify({ limit }),
  });
}

export async function recalculateAuthority(): Promise<RecalculateResult> {
  return authFetch("/admin/recalculate-authority", { method: "POST" });
}

export async function joinWaitlist(email: string, source = "dashboard"): Promise<{ message: string }> {
  const API_BASE = import.meta.env.VITE_API_URL || "/api";
  const res = await fetch(`${API_BASE}/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, source }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to join waitlist");
  return data;
}
