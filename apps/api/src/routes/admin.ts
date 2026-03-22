import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../lib/admin.js";
import type { ResultStore } from "../services/store.js";
import type { CacheService } from "../services/cache.js";
import {
  setDynamicAuthority,
  computeCoCitationGraph,
  setCoCitationGraph,
  computeUsefulnessScores,
  setUsefulnessScores,
  persistDomainIntelState,
} from "../lib/verify.js";
import { getLearningStats, exportLearningState } from "../lib/learning.js";

const AddAdminSchema = z.object({
  email: z.string().email(),
});

/** 30 admin requests per minute per admin email */
const ADMIN_RATE_LIMIT = 30;
const ADMIN_RATE_WINDOW = 60;

async function checkAdminRateLimit(
  cache: CacheService,
  adminEmail: string,
): Promise<boolean> {
  const key = `admin_rl:${adminEmail}`;
  const count = await cache.incr(key, ADMIN_RATE_WINDOW);
  return count <= ADMIN_RATE_LIMIT;
}

export function registerAdminRoutes(
  app: FastifyInstance,
  supabaseUrl: string,
  serviceRoleKey: string,
  store: ResultStore,
  cache?: CacheService,
) {
  // Helper: authenticate admin + check rate limit in one call (avoids double auth lookups)
  async function authenticateAdmin(
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply,
  ): Promise<{ email: string } | null> {
    const admin = await requireAdmin(request, supabaseUrl, serviceRoleKey);
    if (!admin) {
      reply.status(403).send({ success: false, error: "Forbidden" });
      return null;
    }
    if (cache && !(await checkAdminRateLimit(cache, admin.email))) {
      reply.status(429).send({ success: false, error: "Admin rate limit exceeded (30/min)" });
      return null;
    }
    return admin;
  }

  // Admin dashboard metrics
  app.get("/admin/metrics", async (request, reply) => {
    const admin = await authenticateAdmin(request, reply);
    if (!admin) return;

    // Fetch in parallel: analytics, waitlist count, admin list, client breakdown, package stats, users, user queries
    const [analytics, waitlistData, adminList, clientBreakdown, packageStats, usersData, userQueries] = await Promise.all([
      store.getAnalyticsSummary(),
      fetchWaitlistCount(supabaseUrl, serviceRoleKey),
      fetchAdminList(supabaseUrl, serviceRoleKey),
      fetchClientBreakdown(supabaseUrl, serviceRoleKey),
      fetchPackageStats(),
      fetchUsers(supabaseUrl, serviceRoleKey),
      fetchUserQueryBreakdown(supabaseUrl, serviceRoleKey),
    ]);

    return reply.send({
      success: true,
      result: {
        ...analytics,
        waitlistCount: waitlistData.count,
        admins: adminList,
        clientBreakdown,
        packageStats,
        users: usersData.users,
        totalUsers: usersData.total,
        userQueries,
        learning: getLearningStats(),
      },
    });
  });

  // List admins
  app.get("/admin/admins", async (request, reply) => {
    const admin = await authenticateAdmin(request, reply);
    if (!admin) return;

    const list = await fetchAdminList(supabaseUrl, serviceRoleKey);
    return reply.send({ success: true, result: list });
  });

  // Add admin
  app.post("/admin/admins", async (request, reply) => {
    const admin = await authenticateAdmin(request, reply);
    if (!admin) return;

    const parsed = AddAdminSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Invalid email" });
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/admins`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ email: parsed.data.email }),
    });

    if (res.status === 409) {
      return reply.send({ success: true, message: "Already an admin" });
    }
    if (!res.ok) {
      return reply.status(500).send({ success: false, error: "Failed to add admin" });
    }
    return reply.send({ success: true, message: "Admin added" });
  });

  // Recalculate all domain intelligence from stored query results
  // This computes: dynamic authority, co-citation graph, and source usefulness
  app.post("/admin/recalculate-authority", async (request, reply) => {
    const admin = await authenticateAdmin(request, reply);
    if (!admin) return;

    // Fetch raw results for co-citation and usefulness computation
    const rawResults = await store.getRecentResults(5000);

    // 1. Dynamic domain authority (existing)
    const domainStats = await store.getDomainStats(5000);
    const dynamicStats = domainStats.map(s => ({
      domain: s.domain,
      verificationRate: s.verificationRate,
      sampleCount: s.totalClaims,
    }));
    setDynamicAuthority(dynamicStats);

    // 2. Co-citation graph (PageRank alternative)
    const coCitationGraph = computeCoCitationGraph(
      rawResults.map(r => ({ sources: r.result.sources || [] }))
    );
    setCoCitationGraph(coCitationGraph);

    // 3. Source usefulness (click signal alternative)
    const usefulnessScores = computeUsefulnessScores(
      rawResults.map(r => ({
        sources: r.result.sources || [],
        claims: r.result.claims || [],
      }))
    );
    setUsefulnessScores(usefulnessScores);

    // Persist co-citation + usefulness to Redis
    await persistDomainIntelState();

    // Persist dynamic authority to DB
    const dbEntries = dynamicStats.map(d => ({
      domain: d.domain,
      dynamic_score: Math.round(d.verificationRate * 100) / 100,
      sample_count: d.sampleCount,
    }));
    const persisted = await store.saveDomainAuthority(dbEntries);

    // Top co-cited domains
    const topCoCited = [...coCitationGraph.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, score]) => ({ domain, coCitationScore: score }));

    // Top useful domains
    const topUseful = [...usefulnessScores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 10)
      .map(([domain, data]) => ({ domain, usefulness: Math.round(data.score * 100) / 100, samples: data.totalCount }));

    return reply.send({
      success: true,
      result: {
        domainsUpdated: dynamicStats.length,
        coCitationDomains: coCitationGraph.size,
        usefulnessDomains: usefulnessScores.size,
        persistedToDB: persisted,
        topDomains: dynamicStats.slice(0, 10).map(d => ({
          domain: d.domain,
          score: d.verificationRate,
          samples: d.sampleCount,
        })),
        topCoCited,
        topUseful,
      },
    });
  });

  // Import domain authority from Majestic Million (free CSV, CC license)
  app.post("/admin/import-domain-data", async (request, reply) => {
    const admin = await authenticateAdmin(request, reply);
    if (!admin) return;

    const { limit: importLimit } = (request.body as { limit?: number }) || {};
    const maxDomains = Math.min(importLimit || 10000, 50000);

    try {
      // Download Majestic Million CSV (free, CC-BY-3.0)
      const res = await fetch("https://downloads.majestic.com/majestic_million.csv");
      if (!res.ok) {
        return reply.status(502).send({ success: false, error: `Majestic download failed: ${res.status}` });
      }

      const text = await res.text();
      const lines = text.split("\n");

      // Parse CSV: GlobalRank,TldRank,Domain,TLD,...
      const entries: { domain: string; tier: number; static_score: number; global_rank: number; curated: boolean }[] = [];

      for (let i = 1; i < lines.length && entries.length < maxDomains; i++) {
        const cols = lines[i].split(",");
        if (cols.length < 4) continue;

        const rank = parseInt(cols[0]);
        const domain = cols[2]?.trim().toLowerCase();
        if (!domain || !rank) continue;

        // Map rank to base score (popularity != authority, so scores are conservative)
        let score: number;
        if (rank <= 100) score = 0.65;
        else if (rank <= 500) score = 0.60;
        else if (rank <= 2000) score = 0.58;
        else if (rank <= 10000) score = 0.55;
        else if (rank <= 50000) score = 0.50;
        else score = 0.48;

        entries.push({
          domain,
          tier: -1, // auto-scored, not curated
          static_score: score,
          global_rank: rank,
          curated: false,
        });
      }

      // Save to DB (ON CONFLICT will merge, but curated entries won't be overwritten due to Prefer header)
      const saved = await store.saveDomainAuthority(entries);

      // Reload into memory
      const { initDomainAuthority } = await import("../lib/verify.js");
      const loaded = await initDomainAuthority(store);

      return reply.send({
        success: true,
        result: {
          parsed: entries.length,
          savedToDB: saved,
          loadedToMemory: loaded,
          sampleDomains: entries.slice(0, 5).map(e => ({
            domain: e.domain,
            rank: e.global_rank,
            score: e.static_score,
          })),
        },
      });
    } catch (e: unknown) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: `Import failed: ${e instanceof Error ? e.message : "Unknown error"}` });
    }
  });

  // Learning engine state
  app.get("/admin/learning", async (request, reply) => {
    const admin = await authenticateAdmin(request, reply);
    if (!admin) return;

    return reply.send({
      success: true,
      result: {
        stats: getLearningStats(),
        state: exportLearningState(),
      },
    });
  });

  // Remove admin (cannot remove yourself)
  app.delete("/admin/admins/:email", async (request, reply) => {
    const admin = await authenticateAdmin(request, reply);
    if (!admin) return;

    const { email } = request.params as { email: string };
    if (email === admin.email) {
      return reply.status(400).send({ success: false, error: "Cannot remove yourself" });
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/admins?email=eq.${encodeURIComponent(email)}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      return reply.status(500).send({ success: false, error: "Failed to remove admin" });
    }
    return reply.send({ success: true, message: "Admin removed" });
  });
}

async function fetchWaitlistCount(supabaseUrl: string, serviceRoleKey: string) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/waitlist?select=id`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "count=exact",
      },
    }
  );
  const count = res.headers.get("content-range")?.split("/")[1];
  return { count: count ? parseInt(count) : 0 };
}

async function fetchAdminList(supabaseUrl: string, serviceRoleKey: string) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/admins?select=id,email,created_at&order=created_at.asc`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) return [];
  return res.json();
}

interface PkgDownloads { weekly: number; total: number }

async function fetchPyPIPkg(name: string): Promise<PkgDownloads> {
  const [weekR, totalR] = await Promise.all([
    fetch(`https://pypistats.org/api/packages/${name}/recent?period=week`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`https://pypistats.org/api/packages/${name}/overall?mirrors=false`).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  return {
    weekly: weekR?.data?.last_week || 0,
    total: totalR?.data?.reduce((s: number, d: { downloads: number }) => s + d.downloads, 0) || 0,
  };
}

async function fetchPackageStats(): Promise<{
  npm: { weeklyDownloads: number; totalDownloads: number; new: PkgDownloads; old: PkgDownloads } | null;
  pypi: { weeklyDownloads: number; totalDownloads: number; new: PkgDownloads; old: PkgDownloads } | null;
  github: { stars: number; forks: number; openIssues: number } | null;
  frameworks: { langchain: PkgDownloads; crewai: PkgDownloads; llamaindex: PkgDownloads } | null;
}> {
  const [npm, pypi, github, frameworks] = await Promise.all([
    // npm downloads (browseai-dev + browse-ai redirect)
    Promise.all([
      fetch("https://api.npmjs.org/downloads/point/last-week/browseai-dev").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("https://api.npmjs.org/downloads/point/last-week/browse-ai").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("https://api.npmjs.org/downloads/point/2000-01-01:2030-01-01/browseai-dev").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("https://api.npmjs.org/downloads/point/2000-01-01:2030-01-01/browse-ai").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([newWeek, oldWeek, newTotal, oldTotal]) => {
      const nw = newWeek?.downloads || 0, ow = oldWeek?.downloads || 0;
      const nt = newTotal?.downloads || 0, ot = oldTotal?.downloads || 0;
      return {
        weeklyDownloads: nw + ow, totalDownloads: nt + ot,
        new: { weekly: nw, total: nt }, old: { weekly: ow, total: ot },
      };
    }).catch(() => null),
    // PyPI downloads (browseaidev + browseai redirect)
    Promise.all([
      fetchPyPIPkg("browseaidev"),
      fetchPyPIPkg("browseai"),
    ]).then(([newPkg, oldPkg]) => ({
      weeklyDownloads: newPkg.weekly + oldPkg.weekly,
      totalDownloads: newPkg.total + oldPkg.total,
      new: newPkg, old: oldPkg,
    })).catch(() => null),
    // GitHub stats
    fetch("https://api.github.com/repos/BrowseAI-HQ/BrowseAI-Dev")
      .then(async (r) => {
        if (!r.ok) return null;
        const data = await r.json();
        return { stars: data.stargazers_count || 0, forks: data.forks_count || 0, openIssues: data.open_issues_count || 0 };
      })
      .catch(() => null),
    // Framework integration packages
    Promise.all([
      fetchPyPIPkg("langchain-browseaidev"),
      fetchPyPIPkg("crewai-browseaidev"),
      fetchPyPIPkg("llamaindex-browseaidev"),
    ]).then(([langchain, crewai, llamaindex]) => ({ langchain, crewai, llamaindex })).catch(() => null),
  ]);

  return { npm, pypi, github, frameworks };
}

async function fetchUsers(supabaseUrl: string, serviceRoleKey: string) {
  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?per_page=100`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );
  if (!res.ok) return { users: [], total: 0 };
  const data = await res.json();
  const users = (data.users || []).map((u: { id: string; email: string; user_metadata?: { full_name?: string; avatar_url?: string }; created_at: string; last_sign_in_at: string | null }) => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name || null,
    avatar_url: u.user_metadata?.avatar_url || null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));
  return { users, total: users.length };
}

async function fetchUserQueryBreakdown(supabaseUrl: string, serviceRoleKey: string) {
  // Get recent results with user_id
  const res = await fetch(
    `${supabaseUrl}/rest/v1/browse_results?select=user_id,query,tool,created_at&order=created_at.desc&limit=5000`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) return [];
  const rows: { user_id: string | null; query: string; tool: string; created_at: string }[] = await res.json();

  // Group by user_id
  const byUser = new Map<string, { count: number; lastQuery: string; lastAt: string; tools: Map<string, number> }>();
  for (const row of rows) {
    const uid = row.user_id || "anonymous";
    const entry = byUser.get(uid);
    if (entry) {
      entry.count++;
      entry.tools.set(row.tool, (entry.tools.get(row.tool) || 0) + 1);
    } else {
      const tools = new Map<string, number>();
      tools.set(row.tool, 1);
      byUser.set(uid, { count: 1, lastQuery: row.query, lastAt: row.created_at, tools });
    }
  }

  return [...byUser.entries()]
    .map(([userId, data]) => ({
      userId,
      queryCount: data.count,
      lastQuery: data.lastQuery,
      lastAt: data.lastAt,
      tools: Object.fromEntries(data.tools),
    }))
    .sort((a, b) => b.queryCount - a.queryCount);
}

async function fetchClientBreakdown(supabaseUrl: string, serviceRoleKey: string) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/browse_results?client=not.is.null&select=client&limit=5000&order=created_at.desc`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) return [];
  const rows: { client: string }[] = await res.json();
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.client, (counts.get(row.client) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([client, count]) => ({ client, count }))
    .sort((a, b) => b.count - a.count);
}
