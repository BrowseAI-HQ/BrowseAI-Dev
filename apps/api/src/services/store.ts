import type { BrowseResult } from "@browse/shared";

export interface ResultStore {
  save(query: string, result: BrowseResult, userId?: string, tool?: string): Promise<string>;
  get(id: string): Promise<{ query: string; result: BrowseResult; created_at: string } | null>;
  count(): Promise<number>;
  getUserHistory(userId: string, limit?: number): Promise<{ id: string; query: string; tool: string; created_at: string }[]>;
  getUserStats(userId: string): Promise<{ totalQueries: number; thisMonth: number }>;
}

export function createSupabaseStore(supabaseUrl: string, serviceRoleKey: string): ResultStore {
  async function supabaseFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: options.method === "POST" ? "return=representation" : "return=minimal",
        ...options.headers,
      },
    });
    return res;
  }

  return {
    async save(query: string, result: BrowseResult, userId?: string, tool?: string): Promise<string> {
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const body: Record<string, unknown> = { id, query, result };
      if (userId) body.user_id = userId;
      if (tool) body.tool = tool;
      const res = await supabaseFetch("/browse_results", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.warn("Failed to save result:", res.status);
        return id;
      }
      return id;
    },

    async get(id: string) {
      const res = await supabaseFetch(`/browse_results?id=eq.${id}&select=*`);
      if (!res.ok) return null;
      const rows = await res.json();
      return rows[0] || null;
    },

    async count() {
      const res = await supabaseFetch("/browse_results?select=id", {
        headers: { Prefer: "count=exact" },
      });
      const count = res.headers.get("content-range")?.split("/")[1];
      return count ? parseInt(count) : 0;
    },

    async getUserHistory(userId: string, limit = 20) {
      const res = await supabaseFetch(
        `/browse_results?user_id=eq.${userId}&select=id,query,tool,created_at&order=created_at.desc&limit=${limit}`
      );
      if (!res.ok) return [];
      return res.json();
    },

    async getUserStats(userId: string) {
      const totalRes = await supabaseFetch(
        `/browse_results?user_id=eq.${userId}&select=id`,
        { headers: { Prefer: "count=exact" } }
      );
      const totalCount = totalRes.headers.get("content-range")?.split("/")[1];
      const totalQueries = totalCount ? parseInt(totalCount) : 0;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthRes = await supabaseFetch(
        `/browse_results?user_id=eq.${userId}&created_at=gte.${monthStart}&select=id`,
        { headers: { Prefer: "count=exact" } }
      );
      const monthCount = monthRes.headers.get("content-range")?.split("/")[1];
      const thisMonth = monthCount ? parseInt(monthCount) : 0;

      return { totalQueries, thisMonth };
    },
  };
}

export function createNoopStore(): ResultStore {
  return {
    async save() { return "no-store"; },
    async get() { return null; },
    async count() { return 0; },
    async getUserHistory() { return []; },
    async getUserStats() { return { totalQueries: 0, thisMonth: 0 }; },
  };
}
