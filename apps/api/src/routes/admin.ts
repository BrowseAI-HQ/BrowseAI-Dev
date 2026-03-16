import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../lib/admin.js";
import type { ResultStore } from "../services/store.js";
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

export function registerAdminRoutes(
  app: FastifyInstance,
  supabaseUrl: string,
  serviceRoleKey: string,
  store: ResultStore
) {
  // Admin dashboard metrics
  app.get("/admin/metrics", async (request, reply) => {
    const admin = await requireAdmin(request, supabaseUrl, serviceRoleKey);
    if (!admin) return reply.status(403).send({ success: false, error: "Forbidden" });

    // Fetch in parallel: analytics, waitlist count, admin list, client breakdown, package stats, users
    const [analytics, waitlistData, adminList, clientBreakdown, packageStats, usersData] = await Promise.all([
      store.getAnalyticsSummary(),
      fetchWaitlistCount(supabaseUrl, serviceRoleKey),
      fetchAdminList(supabaseUrl, serviceRoleKey),
      fetchClientBreakdown(supabaseUrl, serviceRoleKey),
      fetchPackageStats(),
      fetchUsers(supabaseUrl, serviceRoleKey),
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
        learning: getLearningStats(),
      },
    });
  });

  // List admins
  app.get("/admin/admins", async (request, reply) => {
    const admin = await requireAdmin(request, supabaseUrl, serviceRoleKey);
    if (!admin) return reply.status(403).send({ success: false, error: "Forbidden" });

    const list = await fetchAdminList(supabaseUrl, serviceRoleKey);
    return reply.send({ success: true, result: list });
  });

  // Add admin
  app.post("/admin/admins", async (request, reply) => {
    const admin = await requireAdmin(request, supabaseUrl, serviceRoleKey);
    if (!admin) return reply.status(403).send({ success: false, error: "Forbidden" });

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
    const admin = await requireAdmin(request, supabaseUrl, serviceRoleKey);
    if (!admin) return reply.status(403).send({ success: false, error: "Forbidden" });

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
    const admin = await requireAdmin(request, supabaseUrl, serviceRoleKey);
    if (!admin) return reply.status(403).send({ success: false, error: "Forbidden" });

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
    const admin = await requireAdmin(request, supabaseUrl, serviceRoleKey);
    if (!admin) return reply.status(403).send({ success: false, error: "Forbidden" });

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
    const admin = await requireAdmin(request, supabaseUrl, serviceRoleKey);
    if (!admin) return reply.status(403).send({ success: false, error: "Forbidden" });

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

async function fetchPackageStats(): Promise<{
  npm: { weeklyDownloads: number; totalDownloads: number } | null;
  pypi: { weeklyDownloads: number; totalDownloads: number } | null;
  github: { stars: number; forks: number; openIssues: number } | null;
}> {
  const [npm, pypi, github] = await Promise.all([
    // npm weekly downloads (combine old browse-ai + new browseai-dev)
    Promise.all([
      fetch("https://api.npmjs.org/downloads/point/last-week/browseai-dev").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("https://api.npmjs.org/downloads/point/last-week/browse-ai").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("https://api.npmjs.org/downloads/point/2000-01-01:2030-01-01/browseai-dev").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("https://api.npmjs.org/downloads/point/2000-01-01:2030-01-01/browse-ai").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([newWeek, oldWeek, newTotal, oldTotal]) => ({
      weeklyDownloads: (newWeek?.downloads || 0) + (oldWeek?.downloads || 0),
      totalDownloads: (newTotal?.downloads || 0) + (oldTotal?.downloads || 0),
    })).catch(() => null),
    // PyPI downloads (combine old browseai + new browseaidev)
    Promise.all([
      fetch("https://pypistats.org/api/packages/browseaidev/recent?period=week").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("https://pypistats.org/api/packages/browseai/recent?period=week").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("https://pypistats.org/api/packages/browseaidev/overall?mirrors=false").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("https://pypistats.org/api/packages/browseai/overall?mirrors=false").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([newWeek, oldWeek, newTotal, oldTotal]) => {
      const newTotalDl = newTotal?.data?.reduce((s: number, d: { downloads: number }) => s + d.downloads, 0) || 0;
      const oldTotalDl = oldTotal?.data?.reduce((s: number, d: { downloads: number }) => s + d.downloads, 0) || 0;
      return {
        weeklyDownloads: (newWeek?.data?.last_week || 0) + (oldWeek?.data?.last_week || 0),
        totalDownloads: newTotalDl + oldTotalDl,
      };
    }).catch(() => null),
    // GitHub stats
    fetch("https://api.github.com/repos/BrowseAI-HQ/BrowseAI-Dev")
      .then(async (r) => {
        if (!r.ok) return null;
        const data = await r.json();
        return {
          stars: data.stargazers_count || 0,
          forks: data.forks_count || 0,
          openIssues: data.open_issues_count || 0,
        };
      })
      .catch(() => null),
  ]);

  return { npm, pypi, github };
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
