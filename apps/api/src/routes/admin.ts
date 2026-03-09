import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../lib/admin.js";
import type { ResultStore } from "../services/store.js";

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

    // Fetch in parallel: analytics, waitlist count, admin list, client breakdown, package stats
    const [analytics, waitlistData, adminList, clientBreakdown, packageStats] = await Promise.all([
      store.getAnalyticsSummary(),
      fetchWaitlistCount(supabaseUrl, serviceRoleKey),
      fetchAdminList(supabaseUrl, serviceRoleKey),
      fetchClientBreakdown(supabaseUrl, serviceRoleKey),
      fetchPackageStats(),
    ]);

    return reply.send({
      success: true,
      result: {
        ...analytics,
        waitlistCount: waitlistData.count,
        admins: adminList,
        clientBreakdown,
        packageStats,
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
    // npm weekly downloads
    fetch("https://api.npmjs.org/downloads/point/last-week/browse-ai")
      .then(async (r) => {
        if (!r.ok) return null;
        const data = await r.json();
        // Also get total (all-time) — npm only gives ranges, use last-year as proxy
        const totalRes = await fetch("https://api.npmjs.org/downloads/point/2000-01-01:2030-01-01/browse-ai");
        const totalData = totalRes.ok ? await totalRes.json() : null;
        return {
          weeklyDownloads: data.downloads || 0,
          totalDownloads: totalData?.downloads || 0,
        };
      })
      .catch(() => null),
    // PyPI downloads (use pypistats API)
    fetch("https://pypistats.org/api/packages/browseai/recent?period=week")
      .then(async (r) => {
        if (!r.ok) return null;
        const data = await r.json();
        // Get overall stats
        const overallRes = await fetch("https://pypistats.org/api/packages/browseai/overall?mirrors=false");
        const overallData = overallRes.ok ? await overallRes.json() : null;
        const totalDownloads = overallData?.data?.reduce((s: number, d: { downloads: number }) => s + d.downloads, 0) || 0;
        return {
          weeklyDownloads: data.data?.last_week || 0,
          totalDownloads,
        };
      })
      .catch(() => null),
    // GitHub stats
    fetch("https://api.github.com/repos/BrowseAI-HQ/BrowserAI-Dev")
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
