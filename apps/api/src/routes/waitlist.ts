import type { FastifyInstance } from "fastify";
import { z } from "zod";

const WaitlistSchema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
});

const ADMIN_EMAIL = "shreyassaw@gmail.com";

export function registerWaitlistRoutes(
  app: FastifyInstance,
  supabaseUrl: string,
  serviceRoleKey: string
) {
  // Admin-only: list waitlist signups
  app.get("/waitlist", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ success: false, error: "Unauthorized" });
    }

    const token = authHeader.slice(7);
    // Verify the JWT and check admin email
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userRes.ok) {
      return reply.status(401).send({ success: false, error: "Unauthorized" });
    }
    const userData = await userRes.json();
    if (userData.email !== ADMIN_EMAIL) {
      return reply.status(403).send({ success: false, error: "Forbidden" });
    }

    // Fetch waitlist
    const res = await fetch(
      `${supabaseUrl}/rest/v1/waitlist?select=id,email,source,created_at&order=created_at.desc`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "count=exact",
        },
      }
    );
    if (!res.ok) {
      return reply.status(500).send({ success: false, error: "Failed to fetch waitlist" });
    }
    const entries = await res.json();
    const count = res.headers.get("content-range")?.split("/")[1];
    return reply.send({
      success: true,
      result: { entries, total: count ? parseInt(count) : entries.length },
    });
  });

  // Check if logged-in user is on waitlist
  app.get("/waitlist/status", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ success: false, error: "Unauthorized" });
    }

    const token = authHeader.slice(7);
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userRes.ok) {
      return reply.status(401).send({ success: false, error: "Unauthorized" });
    }
    const userData = await userRes.json();

    const res = await fetch(
      `${supabaseUrl}/rest/v1/waitlist?email=eq.${encodeURIComponent(userData.email)}&select=id`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      return reply.status(500).send({ success: false, error: "Failed to check waitlist" });
    }
    const rows = await res.json();
    return reply.send({ success: true, result: { onWaitlist: rows.length > 0 } });
  });

  app.post("/waitlist", async (request, reply) => {
    const parsed = WaitlistSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Invalid email" });
    }

    const { email } = parsed.data;

    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/waitlist`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          email,
          source: parsed.data.source || "landing_page",
        }),
      });

      // 409 = duplicate email (unique constraint)
      if (res.status === 409) {
        return reply.send({ success: true, message: "Already on the list" });
      }

      if (!res.ok) {
        console.warn("Waitlist insert failed:", res.status);
        return reply.status(500).send({ success: false, error: "Failed to join waitlist" });
      }

      return reply.send({ success: true, message: "You're on the list" });
    } catch (e) {
      console.error("Waitlist error:", e);
      return reply.status(500).send({ success: false, error: "Server error" });
    }
  });
}
