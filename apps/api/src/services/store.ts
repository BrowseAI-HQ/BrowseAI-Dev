import type { BrowseResult } from "@browse/shared";

export interface SaveOptions {
  cacheHit?: boolean;
}

export interface ResultStore {
  save(query: string, result: BrowseResult, userId?: string, tool?: string, options?: SaveOptions): Promise<string>;
  get(id: string): Promise<{ query: string; result: BrowseResult; created_at: string } | null>;
  count(): Promise<number>;
  getUserHistory(userId: string, limit?: number): Promise<{ id: string; query: string; tool: string; created_at: string }[]>;
  getUserStats(userId: string): Promise<{ totalQueries: number; thisMonth: number }>;
  getTopSources(limit?: number): Promise<{ domain: string; count: number }[]>;
  getAnalyticsSummary(): Promise<{
    totalQueries: number;
    queriesToday: number;
    avgConfidence: number | null;
    avgResponseTimeMs: number | null;
    cacheHitRate: number | null;
  }>;
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
    async save(query: string, result: BrowseResult, userId?: string, tool?: string, options?: SaveOptions): Promise<string> {
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const body: Record<string, unknown> = { id, query, result };
      if (userId) body.user_id = userId;
      if (tool) body.tool = tool;

      // Source domain tracking
      if (result.sources?.length) {
        body.source_domains = [...new Set(result.sources.map(s => s.domain))];
      }
      if (result.trace?.length) {
        body.response_time_ms = result.trace.reduce((sum, t) => sum + t.duration_ms, 0);
      }
      if (options?.cacheHit !== undefined) {
        body.cache_hit = options.cacheHit;
      }

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

    async getTopSources(limit = 20) {
      // Use PostgREST RPC or fall back to fetching source_domains and aggregating in JS
      const res = await supabaseFetch(
        `/browse_results?source_domains=not.is.null&select=source_domains&limit=1000&order=created_at.desc`
      );
      if (!res.ok) return [];
      const rows: { source_domains: string[] }[] = await res.json();
      const counts = new Map<string, number>();
      for (const row of rows) {
        for (const domain of row.source_domains) {
          counts.set(domain, (counts.get(domain) || 0) + 1);
        }
      }
      return [...counts.entries()]
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    },

    async getAnalyticsSummary() {
      // Total queries
      const totalRes = await supabaseFetch("/browse_results?select=id", {
        headers: { Prefer: "count=exact" },
      });
      const totalCount = totalRes.headers.get("content-range")?.split("/")[1];
      const totalQueries = totalCount ? parseInt(totalCount) : 0;

      // Queries today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayRes = await supabaseFetch(
        `/browse_results?created_at=gte.${todayStart.toISOString()}&select=id`,
        { headers: { Prefer: "count=exact" } }
      );
      const todayCount = todayRes.headers.get("content-range")?.split("/")[1];
      const queriesToday = todayCount ? parseInt(todayCount) : 0;

      // Fetch recent results for averages
      const recentRes = await supabaseFetch(
        `/browse_results?select=result,response_time_ms,cache_hit&limit=500&order=created_at.desc`
      );
      if (!recentRes.ok) {
        return { totalQueries, queriesToday, avgConfidence: null, avgResponseTimeMs: null, cacheHitRate: null };
      }
      const recent: { result: BrowseResult; response_time_ms: number | null; cache_hit: boolean | null }[] = await recentRes.json();

      const confidences = recent.map(r => r.result?.confidence).filter((c): c is number => c != null && c > 0);
      const times = recent.map(r => r.response_time_ms).filter((t): t is number => t != null);
      const cacheHits = recent.filter(r => r.cache_hit === true).length;

      return {
        totalQueries,
        queriesToday,
        avgConfidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null,
        avgResponseTimeMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
        cacheHitRate: recent.length ? cacheHits / recent.length : null,
      };
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
    async getTopSources() { return []; },
    async getAnalyticsSummary() { return { totalQueries: 0, queriesToday: 0, avgConfidence: null, avgResponseTimeMs: null, cacheHitRate: null }; },
  };
}
