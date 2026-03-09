import type { FastifyInstance } from "fastify";
import { z } from "zod";

const WaitlistSchema = z.object({
  email: z.string().email(),
});

export function registerWaitlistRoutes(
  app: FastifyInstance,
  supabaseUrl: string,
  serviceRoleKey: string
) {
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
          source: "landing_page",
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
