import { describe, it, expect, vi, beforeAll } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createHmac } from "crypto";

// Mock services for integration testing
function createMockCache() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    set: vi.fn(async (key: string, val: string) => { store.set(key, val); }),
    _store: store,
  };
}

function createMockStore() {
  return {
    save: vi.fn(async () => "test-id-123"),
    get: vi.fn(async () => null),
    count: vi.fn(async () => 42),
    getUserHistory: vi.fn(async () => []),
    getUserStats: vi.fn(async () => ({ totalQueries: 5, thisMonth: 2 })),
    getTopSources: vi.fn(async () => []),
    getAnalyticsSummary: vi.fn(async () => ({
      totalQueries: 100,
      queriesToday: 10,
      avgConfidence: 0.75,
      avgResponseTimeMs: 1500,
      cacheHitRate: 0.3,
    })),
    getDomainStats: vi.fn(async () => []),
    getRecentResults: vi.fn(async () => []),
    loadDomainAuthority: vi.fn(async () => []),
    saveDomainAuthority: vi.fn(async () => 0),
    updateDomainScores: vi.fn(async () => {}),
  };
}

function createMockSessionStore() {
  const sessions = new Map<string, any>();
  return {
    createSession: vi.fn(async (name: string, userId?: string) => {
      const id = "sess-" + Math.random().toString(36).slice(2, 8);
      const session = { id, name, userId, claimCount: 0, queryCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      sessions.set(id, session);
      return session;
    }),
    getSession: vi.fn(async (id: string) => sessions.get(id) || null),
    deleteSession: vi.fn(async (id: string) => { sessions.delete(id); return true; }),
    listSessions: vi.fn(async () => [...sessions.values()]),
    storeKnowledge: vi.fn(async () => 0),
    recallKnowledge: vi.fn(async () => []),
    getKnowledge: vi.fn(async () => []),
    touchSession: vi.fn(async () => {}),
    shareSession: vi.fn(async () => "share-abc123"),
    getSharedSession: vi.fn(async () => null),
    _sessions: sessions,
  };
}

// JWT helpers
const JWT_SECRET = "test-secret-for-routes";

function base64UrlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function createTestJWT(sub: string, secret = JWT_SECRET): string {
  const header = base64UrlEncode({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlEncode({
    sub,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

describe("Health endpoint", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.get("/health", async () => ({ status: "ok" }));
    await app.ready();
  });

  it("returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("Session routes", () => {
  let app: FastifyInstance;
  let sessionStore: ReturnType<typeof createMockSessionStore>;
  let cache: ReturnType<typeof createMockCache>;

  beforeAll(async () => {
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
    sessionStore = createMockSessionStore();
    cache = createMockCache();

    app = Fastify();

    // Import and register session routes
    const { registerSessionRoutes } = await import("../src/routes/session.js");
    const env = {
      PORT: 3001,
      SERP_API_KEY: "test-tavily",
      OPENROUTER_API_KEY: "test-openrouter",
      CORS_ORIGIN: "*",
    } as any;

    registerSessionRoutes(app, env, cache as any, createMockStore() as any, sessionStore as any, null);
    await app.ready();
  });

  it("creates a session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/session",
      payload: { name: "Test Research" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.name).toBe("Test Research");
  });

  it("creates a session with authenticated user", async () => {
    const token = createTestJWT("user-456");
    const res = await app.inject({
      method: "POST",
      url: "/session",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Auth Session" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it("returns 400 for session without name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/session",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it("gets a session by ID", async () => {
    // Create first
    const createRes = await app.inject({
      method: "POST",
      url: "/session",
      payload: { name: "Fetch Me" },
    });
    const { id } = createRes.json().result;

    const res = await app.inject({ method: "GET", url: `/session/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.name).toBe("Fetch Me");
  });

  it("returns 404 for non-existent session", async () => {
    const res = await app.inject({ method: "GET", url: "/session/non-existent-id" });
    expect(res.statusCode).toBe(404);
  });

  it("deletes a session", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/session",
      payload: { name: "Delete Me" },
    });
    const { id } = createRes.json().result;

    const res = await app.inject({ method: "DELETE", url: `/session/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("requires auth for listing sessions", async () => {
    const res = await app.inject({ method: "GET", url: "/sessions" });
    expect(res.statusCode).toBe(401);
  });

  it("lists sessions for authenticated user", async () => {
    const token = createTestJWT("user-789");
    const res = await app.inject({
      method: "GET",
      url: "/sessions",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});

describe("API key routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;

    app = Fastify();

    const mockApiKeyService = {
      create: vi.fn(async () => ({
        apiKey: "bai_testkey123",
        record: { id: "key-1", label: "Test", created_at: new Date().toISOString() },
      })),
      list: vi.fn(async () => []),
      revoke: vi.fn(async () => true),
      resolve: vi.fn(async () => null),
      resolveByUserId: vi.fn(async () => null),
      countActive: vi.fn(async () => 1),
    };

    const { registerApiKeyRoutes } = await import("../src/routes/apiKeys.js");
    registerApiKeyRoutes(app, mockApiKeyService as any);
    await app.ready();
  });

  it("requires auth for creating API keys", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api-keys",
      payload: { tavily_key: "tk", openrouter_key: "ok" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates API key with valid auth", async () => {
    const token = createTestJWT("user-100");
    const res = await app.inject({
      method: "POST",
      url: "/api-keys",
      headers: { authorization: `Bearer ${token}` },
      payload: { tavily_key: "tvly-test", openrouter_key: "sk-or-test" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().result.apiKey).toBe("bai_testkey123");
  });

  it("returns 400 when missing required keys", async () => {
    const token = createTestJWT("user-100");
    const res = await app.inject({
      method: "POST",
      url: "/api-keys",
      headers: { authorization: `Bearer ${token}` },
      payload: { tavily_key: "tvly-test" }, // missing openrouter_key
    });
    expect(res.statusCode).toBe(400);
  });

  it("requires auth for listing API keys", async () => {
    const res = await app.inject({ method: "GET", url: "/api-keys" });
    expect(res.statusCode).toBe(401);
  });

  it("requires auth for revoking API keys", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api-keys/key-1" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects forged JWT (wrong secret)", async () => {
    const forgedToken = createTestJWT("user-100", "wrong-secret");
    const res = await app.inject({
      method: "GET",
      url: "/api-keys",
      headers: { authorization: `Bearer ${forgedToken}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects alg:none attack on protected endpoint", async () => {
    const header = base64UrlEncode({ alg: "none", typ: "JWT" });
    const payload = base64UrlEncode({ sub: "user-100", exp: Math.floor(Date.now() / 1000) + 3600 });
    const fakeToken = `${header}.${payload}.`;
    const res = await app.inject({
      method: "GET",
      url: "/api-keys",
      headers: { authorization: `Bearer ${fakeToken}` },
    });
    expect(res.statusCode).toBe(401);
  });
});
