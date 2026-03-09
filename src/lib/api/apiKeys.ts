import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function authFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });

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
