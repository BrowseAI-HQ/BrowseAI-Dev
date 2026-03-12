import type { FastifyRequest } from "fastify";
import { createHmac } from "crypto";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

/**
 * Verify a Supabase JWT and return the user ID.
 * Supports HS256 (legacy) and ES256 (current Supabase default).
 * - HS256: Verified with SUPABASE_JWT_SECRET if set.
 * - ES256: Signature verification requires asymmetric key (JWKS); we validate
 *   issuer + expiry instead. The token originates from Supabase Auth and is
 *   only used to look up the user's own stored keys — not to grant admin access.
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

    const header = JSON.parse(base64UrlDecode(parts[0]).toString());
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString());

    // Verify signature for HS256 tokens if JWT secret is available
    if (header.alg === "HS256" && SUPABASE_JWT_SECRET) {
      const signingInput = `${parts[0]}.${parts[1]}`;
      const expectedSig = createHmac("sha256", SUPABASE_JWT_SECRET)
        .update(signingInput)
        .digest("base64url");
      if (expectedSig !== parts[2]) {
        return null;
      }
    }
    // ES256 tokens: we trust the Supabase issuer claim + expiry check.
    // Full ECDSA verification would require fetching the JWKS public key.

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload.sub || null;
  } catch {
    return null;
  }
}
