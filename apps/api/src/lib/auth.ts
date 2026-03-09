import type { FastifyRequest } from "fastify";
import { createHmac } from "crypto";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

/**
 * Verify a Supabase JWT and return the user ID.
 * If SUPABASE_JWT_SECRET is set, validates the HS256 signature and expiry.
 * Otherwise falls back to decode-only (dev mode).
 */
export function getUserIdFromRequest(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.split(" ")[1];
    // Skip bai_ keys — those are BrowseAI API keys, not JWTs
    if (token.startsWith("bai_")) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(base64UrlDecode(parts[1]).toString());

    // Verify signature if JWT secret is available
    if (SUPABASE_JWT_SECRET) {
      const signingInput = `${parts[0]}.${parts[1]}`;
      const expectedSig = createHmac("sha256", SUPABASE_JWT_SECRET)
        .update(signingInput)
        .digest("base64url");
      if (expectedSig !== parts[2]) {
        return null;
      }
    }

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload.sub || null;
  } catch {
    return null;
  }
}
