import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

// We test the auth logic by creating JWTs and calling getUserIdFromRequest
// with a mock FastifyRequest object.

function base64UrlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64url");
}

function createHS256JWT(payload: Record<string, unknown>, secret: string): string {
  const header = base64UrlEncode({ alg: "HS256", typ: "JWT" });
  const body = base64UrlEncode(payload);
  const sig = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

function createUnsignedJWT(header: Record<string, unknown>, payload: Record<string, unknown>): string {
  const h = base64UrlEncode(header);
  const b = base64UrlEncode(payload);
  return `${h}.${b}.fakesignature`;
}

function mockRequest(authHeader?: string) {
  return {
    headers: {
      ...(authHeader && { authorization: authHeader }),
    },
  } as any;
}

describe("getUserIdFromRequest", () => {
  const JWT_SECRET = "test-secret-key-for-jwt-testing";
  const VALID_PAYLOAD = {
    sub: "user-123",
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iss: "test",
  };

  beforeEach(() => {
    // Set env vars for each test
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = "https://test.supabase.co";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // We need to re-import to pick up env vars — use dynamic import
  async function getAuth() {
    // Clear module cache to pick up fresh env vars
    const mod = await import("../src/lib/auth.js");
    return mod.getUserIdFromRequest;
  }

  it("returns null when no authorization header", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const result = await getUserIdFromRequest(mockRequest());
    expect(result).toBeNull();
  });

  it("returns null for non-Bearer authorization", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const result = await getUserIdFromRequest(mockRequest("Basic dXNlcjpwYXNz"));
    expect(result).toBeNull();
  });

  it("returns null for bai_ API keys (not JWTs)", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const result = await getUserIdFromRequest(mockRequest("Bearer bai_test123"));
    expect(result).toBeNull();
  });

  it("returns null for malformed JWT (wrong segment count)", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const result = await getUserIdFromRequest(mockRequest("Bearer not.a.valid.jwt.token"));
    expect(result).toBeNull();
  });

  it("returns userId for valid HS256 JWT", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const token = createHS256JWT(VALID_PAYLOAD, JWT_SECRET);
    const result = await getUserIdFromRequest(mockRequest(`Bearer ${token}`));
    expect(result).toBe("user-123");
  });

  it("returns null for HS256 JWT with wrong secret", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const token = createHS256JWT(VALID_PAYLOAD, "wrong-secret");
    const result = await getUserIdFromRequest(mockRequest(`Bearer ${token}`));
    expect(result).toBeNull();
  });

  it("returns null for expired JWT", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const expiredPayload = { ...VALID_PAYLOAD, exp: Math.floor(Date.now() / 1000) - 100 };
    const token = createHS256JWT(expiredPayload, JWT_SECRET);
    const result = await getUserIdFromRequest(mockRequest(`Bearer ${token}`));
    expect(result).toBeNull();
  });

  it("rejects alg: 'none' (algorithm confusion attack)", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const token = createUnsignedJWT({ alg: "none", typ: "JWT" }, VALID_PAYLOAD);
    const result = await getUserIdFromRequest(mockRequest(`Bearer ${token}`));
    expect(result).toBeNull();
  });

  it("rejects unknown algorithms (e.g. HS384)", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const token = createUnsignedJWT({ alg: "HS384", typ: "JWT" }, VALID_PAYLOAD);
    const result = await getUserIdFromRequest(mockRequest(`Bearer ${token}`));
    expect(result).toBeNull();
  });

  it("rejects ES256 token with invalid signature (no JWKS)", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    // Forge an ES256 token with a fake signature — should be rejected
    const token = createUnsignedJWT({ alg: "ES256", typ: "JWT" }, VALID_PAYLOAD);
    const result = await getUserIdFromRequest(mockRequest(`Bearer ${token}`));
    expect(result).toBeNull();
  });

  it("returns null when JWT has no sub claim", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const noSubPayload = { exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = createHS256JWT(noSubPayload, JWT_SECRET);
    const result = await getUserIdFromRequest(mockRequest(`Bearer ${token}`));
    expect(result).toBeNull();
  });

  it("returns null for completely garbage token", async () => {
    const { getUserIdFromRequest } = await import("../src/lib/auth.js");
    const result = await getUserIdFromRequest(mockRequest("Bearer xxxxxxx.yyyyyyy.zzzzzzz"));
    expect(result).toBeNull();
  });
});
