import type { BrowseResult } from "@browse/shared";

export interface SaveOptions {
  cacheHit?: boolean;
  client?: string;
}

export type DomainStats = {
  domain: string;
  totalClaims: number;
  verifiedClaims: number;
  verificationRate: number;
};

export type DomainAuthorityRow = {
  domain: string;
  tier: number;
  static_score: number;
  dynamic_score: number | null;
  sample_count: number;
  global_rank: number | null;
  curated: boolean;
};

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
  /** Compute per-domain verification stats from stored query results */
  getDomainStats(limit?: number): Promise<DomainStats[]>;
  /** Fetch recent results with full result JSONB (for co-citation, usefulness computation) */
  getRecentResults(limit?: number): Promise<{ query: string; result: BrowseResult }[]>;
  /** Load all domain authority rows from DB */
  loadDomainAuthority(): Promise<DomainAuthorityRow[]>;
  /** Upsert domain authority rows (for imports and dynamic score updates) */
  saveDomainAuthority(entries: Partial<DomainAuthorityRow>[]): Promise<number>;
  /** Atomically update domain scores using Postgres function (no race conditions) */
  updateDomainScores(updates: Array<{ domain: string; verified_count: number; total_count: number }>): Promise<void>;
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
      if (options?.client) {
        body.client = options.client;
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

    async getRecentResults(limit = 5000): Promise<{ query: string; result: BrowseResult }[]> {
      const res = await supabaseFetch(
        `/browse_results?select=query,result&limit=${limit}&order=created_at.desc`
      );
      if (!res.ok) return [];
      return res.json();
    },

    async loadDomainAuthority(): Promise<DomainAuthorityRow[]> {
      const res = await supabaseFetch(
        `/domain_authority?select=domain,tier,static_score,dynamic_score,sample_count,global_rank,curated&order=static_score.desc&limit=10000`
      );
      if (!res.ok) {
        console.warn("Failed to load domain authority:", res.status);
        return [];
      }
      return res.json();
    },

    async saveDomainAuthority(entries: Partial<DomainAuthorityRow>[]): Promise<number> {
      if (entries.length === 0) return 0;

      // Batch upsert in chunks of 500
      let saved = 0;
      for (let i = 0; i < entries.length; i += 500) {
        const chunk = entries.slice(i, i + 500);
        const rows = chunk.map((e) => ({
          domain: e.domain,
          ...(e.tier !== undefined && { tier: e.tier }),
          ...(e.static_score !== undefined && { static_score: e.static_score }),
          ...(e.dynamic_score !== undefined && { dynamic_score: e.dynamic_score }),
          ...(e.sample_count !== undefined && { sample_count: e.sample_count }),
          ...(e.global_rank !== undefined && { global_rank: e.global_rank }),
          ...(e.curated !== undefined && { curated: e.curated }),
          updated_at: new Date().toISOString(),
        }));

        const res = await supabaseFetch("/domain_authority", {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(rows),
        });

        if (res.ok) saved += chunk.length;
        else console.warn("Failed to save domain authority chunk:", res.status);
      }
      return saved;
    },

    async updateDomainScores(updates: Array<{ domain: string; verified_count: number; total_count: number }>): Promise<void> {
      if (updates.length === 0) return;
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/update_domain_scores`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        console.warn("Failed to update domain scores:", res.status);
      }
    },

    async getDomainStats(limit = 5000): Promise<DomainStats[]> {
      // Fetch recent results with claims and sources for domain-level verification stats
      const res = await supabaseFetch(
        `/browse_results?select=result&limit=${limit}&order=created_at.desc`
      );
      if (!res.ok) return [];
      const rows: { result: BrowseResult }[] = await res.json();

      // Aggregate: for each domain, count total claims and verified claims
      const stats = new Map<string, { total: number; verified: number }>();

      for (const row of rows) {
        const result = row.result;
        if (!result?.claims || !result?.sources) continue;

        // Build source URL → domain map
        const urlDomain = new Map<string, string>();
        for (const s of result.sources) {
          urlDomain.set(s.url, s.domain);
        }

        for (const claim of result.claims) {
          // Get domains this claim is associated with
          const domains = new Set<string>();
          for (const url of claim.sources || []) {
            const d = urlDomain.get(url);
            if (d) domains.add(d.replace(/^www\./, ""));
          }

          for (const domain of domains) {
            const entry = stats.get(domain) || { total: 0, verified: 0 };
            entry.total++;
            if ((claim as any).verified) entry.verified++;
            stats.set(domain, entry);
          }
        }
      }

      return [...stats.entries()]
        .filter(([, s]) => s.total >= 3) // Only domains with enough data
        .map(([domain, s]) => ({
          domain,
          totalClaims: s.total,
          verifiedClaims: s.verified,
          verificationRate: s.total > 0 ? s.verified / s.total : 0,
        }))
        .sort((a, b) => b.totalClaims - a.totalClaims);
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
    async getDomainStats() { return []; },
    async getRecentResults() { return []; },
    async loadDomainAuthority() { return []; },
    async saveDomainAuthority() { return 0; },
    async updateDomainScores() {},
  };
}
