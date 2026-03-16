import type { FastifyRequest } from "fastify";
import { createHmac, createVerify, timingSafeEqual } from "crypto";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

// ─── JWKS Cache ──────────────────────────────────────────────────────

interface JWKSKey {
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  kid?: string;
}

let jwksCache: { keys: JWKSKey[]; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL_MS = 3600_000; // 1 hour

async function getJWKSKeys(): Promise<JWKSKey[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys;
  }
  if (!SUPABASE_URL) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return jwksCache?.keys || [];
    const data = await res.json();
    jwksCache = { keys: data.keys || [], fetchedAt: Date.now() };
    return jwksCache.keys;
  } catch {
    return jwksCache?.keys || [];
  }
}

// ─── ES256 Verification Helpers ──────────────────────────────────────

function derSequence(content: Buffer): Buffer {
  const len = content.length < 128
    ? Buffer.from([content.length])
    : content.length < 256
      ? Buffer.from([0x81, content.length])
      : Buffer.from([0x82, (content.length >> 8) & 0xff, content.length & 0xff]);
  return Buffer.concat([Buffer.from([0x30]), len, content]);
}

function jwkToPublicKeyPem(jwk: JWKSKey): string {
  if (!jwk.x || !jwk.y) throw new Error("Missing x/y in JWK");
  const x = base64UrlDecode(jwk.x);
  const y = base64UrlDecode(jwk.y);
  const ecPoint = Buffer.concat([Buffer.from([0x04]), x, y]);
  const ecOid = Buffer.from("06072a8648ce3d0201", "hex");
  const curveOid = Buffer.from("06082a8648ce3d030107", "hex");
  const algSeq = derSequence(Buffer.concat([ecOid, curveOid]));
  const bitString = Buffer.concat([Buffer.from([0x03, ecPoint.length + 1, 0x00]), ecPoint]);
  const spki = derSequence(Buffer.concat([algSeq, bitString]));
  return `-----BEGIN PUBLIC KEY-----\n${spki.toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----`;
}

function rawSignatureToDer(raw: Buffer): Buffer {
  if (raw.length !== 64) throw new Error(`Expected 64-byte signature, got ${raw.length}`);
  const r = raw.subarray(0, 32);
  const s = raw.subarray(32, 64);
  function derInt(buf: Buffer): Buffer {
    let start = 0;
    while (start < buf.length - 1 && buf[start] === 0) start++;
    let trimmed = buf.subarray(start);
    if (trimmed[0] & 0x80) trimmed = Buffer.concat([Buffer.from([0x00]), trimmed]);
    return Buffer.concat([Buffer.from([0x02, trimmed.length]), trimmed]);
  }
  const content = Buffer.concat([derInt(r), derInt(s)]);
  return Buffer.concat([Buffer.from([0x30, content.length]), content]);
}

async function verifyES256(parts: string[], header: { kid?: string }): Promise<boolean> {
  const keys = await getJWKSKeys();
  if (keys.length === 0) {
    // No JWKS available — cannot verify ES256
    if (SUPABASE_JWT_SECRET) return false; // Have HS256 capability, reject ES256
    // No verification method at all — log and reject
    console.warn("JWKS unavailable and no JWT secret — rejecting ES256 token");
    return false;
  }

  const key = header.kid
    ? keys.find(k => k.kid === header.kid && k.kty === "EC")
    : keys.find(k => k.kty === "EC" && k.crv === "P-256");

  if (!key || !key.x || !key.y) return false;

  try {
    const pem = jwkToPublicKeyPem(key);
    const signingInput = `${parts[0]}.${parts[1]}`;
    const derSig = rawSignatureToDer(base64UrlDecode(parts[2]));
    const verifier = createVerify("SHA256");
    verifier.update(signingInput);
    return verifier.verify(pem, derSig);
  } catch {
    return false;
  }
}

// ─── Main Auth Function ──────────────────────────────────────────────

const ALLOWED_ALGS = new Set(["HS256", "ES256"]);

/**
 * Verify a Supabase JWT and return the user ID.
 * - HS256: Verified with SUPABASE_JWT_SECRET (required).
 * - ES256: Verified with Supabase JWKS public key (fetched + cached).
 * - All other algorithms are rejected.
 */
export async function getUserIdFromRequest(request: FastifyRequest): Promise<string | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.split(" ")[1];
    if (token.startsWith("bai_")) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(base64UrlDecode(parts[0]).toString());
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString());

    // Reject unknown algorithms (prevents "none" and other attacks)
    if (!ALLOWED_ALGS.has(header.alg)) return null;

    // Check expiry first (cheap)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Verify signature
    if (header.alg === "HS256") {
      if (!SUPABASE_JWT_SECRET) return null;
      const signingInput = `${parts[0]}.${parts[1]}`;
      const expectedSig = createHmac("sha256", SUPABASE_JWT_SECRET)
        .update(signingInput)
        .digest("base64url");
      const expectedBuf = Buffer.from(expectedSig, "utf8");
      const actualBuf = Buffer.from(parts[2], "utf8");
      if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) return null;
    } else if (header.alg === "ES256") {
      if (!await verifyES256(parts, header)) return null;
    }

    // Verify issuer — must match Supabase auth endpoint
    if (SUPABASE_URL) {
      const expectedIssuer = `${SUPABASE_URL.replace(/\/+$/, "")}/auth/v1`;
      if (payload.iss !== expectedIssuer) return null;
    }

    // Verify audience — Supabase uses "authenticated" for signed-in users
    if (payload.aud !== "authenticated") return null;

    return payload.sub || null;
  } catch {
    return null;
  }
}
