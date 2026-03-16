import type { Session, KnowledgeEntry, BrowseClaim } from "@browse/shared";

export interface SessionStore {
  createSession(name: string, userId?: string): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  deleteSession(id: string): Promise<boolean>;
  listSessions(userId: string): Promise<Session[]>;

  /** Store verified claims from a query result into the session's knowledge */
  storeKnowledge(sessionId: string, claims: BrowseClaim[], originQuery: string): Promise<number>;

  /** Recall knowledge entries relevant to a query (keyword-based text search) */
  recallKnowledge(sessionId: string, query: string, limit?: number): Promise<KnowledgeEntry[]>;

  /** Get all knowledge for a session */
  getKnowledge(sessionId: string, limit?: number): Promise<KnowledgeEntry[]>;

  /** Increment query count for a session */
  touchSession(sessionId: string): Promise<void>;

  /** Create a public share link for a session, returns shareId */
  shareSession(sessionId: string): Promise<string>;

  /** Get a shared session by shareId (public, no auth) */
  getSharedSession(shareId: string): Promise<{
    session: { name: string; claimCount: number; queryCount: number };
    entries: KnowledgeEntry[];
  } | null>;
}

export function createSupabaseSessionStore(
  supabaseUrl: string,
  serviceRoleKey: string
): SessionStore {
  async function sbFetch(path: string, options: RequestInit = {}) {
    return fetch(`${supabaseUrl}/rest/v1${path}`, {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: options.method === "POST" ? "return=representation" : "return=minimal",
        ...options.headers,
      },
    });
  }

  return {
    async createSession(name, userId) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const body: Record<string, unknown> = {
        id,
        name,
        claim_count: 0,
        query_count: 0,
        created_at: now,
        updated_at: now,
      };
      if (userId) body.user_id = userId;

      const res = await sbFetch("/sessions", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to create session: ${res.status} ${text}`);
      }
      const rows = await res.json();
      return toSession(rows[0]);
    },

    async getSession(id) {
      const res = await sbFetch(`/sessions?id=eq.${sanitizePostgrestParam(id)}&select=*`);
      if (!res.ok) return null;
      const rows = await res.json();
      if (!rows[0]) return null;
      return toSession(rows[0]);
    },

    async deleteSession(id) {
      const res = await sbFetch(`/sessions?id=eq.${sanitizePostgrestParam(id)}`, { method: "DELETE" });
      return res.ok;
    },

    async listSessions(userId) {
      const res = await sbFetch(
        `/sessions?user_id=eq.${sanitizePostgrestParam(userId)}&select=*&order=updated_at.desc&limit=50`
      );
      if (!res.ok) return [];
      const rows = await res.json();
      return rows.map(toSession);
    },

    async storeKnowledge(sessionId, claims, originQuery) {
      // Only store claims that have at least one source
      const entries = claims
        .filter((c) => c.sources.length > 0)
        .map((c) => ({
          id: crypto.randomUUID(),
          session_id: sessionId,
          claim: c.claim,
          sources: c.sources,
          verified: c.verified ?? false,
          confidence: c.verificationScore ?? 0,
          origin_query: originQuery,
          created_at: new Date().toISOString(),
        }));

      if (entries.length === 0) return 0;

      const res = await sbFetch("/knowledge_entries", {
        method: "POST",
        body: JSON.stringify(entries),
      });

      if (!res.ok) {
        console.warn("Failed to store knowledge:", res.status);
        return 0;
      }

      // Update session claim count + updated_at
      await sbFetch(`/sessions?id=eq.${sanitizePostgrestParam(sessionId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          claim_count: entries.length, // Will be added via RPC later; for now set directly
          updated_at: new Date().toISOString(),
        }),
      });

      return entries.length;
    },

    async recallKnowledge(sessionId, query, limit = 10) {
      // Keyword-based recall: use Postgres full-text search on claim text
      // Extract meaningful keywords from the query (remove stop words)
      const keywords = extractKeywords(query);

      if (keywords.length === 0) {
        // Fallback: return most recent knowledge entries
        return this.getKnowledge(sessionId, limit);
      }

      // Use ilike for flexible matching (works without full-text search setup)
      // Match claims that contain ANY of the keywords
      const orConditions = keywords
        .map((kw) => `claim.ilike.*${encodeURIComponent(kw)}*`)
        .join(",");

      const res = await sbFetch(
        `/knowledge_entries?session_id=eq.${sanitizePostgrestParam(sessionId)}&or=(${orConditions})&order=created_at.desc&limit=${limit}&select=*`
      );

      if (!res.ok) return [];
      const rows = await res.json();

      // If keyword search found nothing, fall back to recent entries
      // This handles vague queries like "How does this work?" where keywords
      // don't match existing claims but session context is still needed
      if (rows.length === 0) {
        return this.getKnowledge(sessionId, limit);
      }

      return rows.map(toKnowledgeEntry);
    },

    async getKnowledge(sessionId, limit = 50) {
      const res = await sbFetch(
        `/knowledge_entries?session_id=eq.${sanitizePostgrestParam(sessionId)}&select=*&order=created_at.desc&limit=${limit}`
      );
      if (!res.ok) return [];
      const rows = await res.json();
      return rows.map(toKnowledgeEntry);
    },

    async touchSession(sessionId) {
      // Increment query_count and update timestamp
      // Using RPC would be ideal, but for now PATCH with a select+increment
      const session = await this.getSession(sessionId);
      if (!session) return;
      await sbFetch(`/sessions?id=eq.${sanitizePostgrestParam(sessionId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          query_count: session.queryCount + 1,
          updated_at: new Date().toISOString(),
        }),
      });
    },

    async shareSession(sessionId) {
      // Use a short hash of session ID as the share ID
      // This is deterministic — sharing the same session always gives the same link
      const encoder = new TextEncoder();
      const data = encoder.encode(sessionId);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
    },

    async getSharedSession(shareId) {
      // Reverse lookup: find session whose hash matches the shareId
      // Since we can't reverse the hash, fetch all sessions and check
      // For efficiency, we store share_id concept: the shareId IS derived from session.id
      // We need to find the session. Let's fetch recent sessions and match.
      // Better approach: just fetch all non-deleted sessions and hash-check
      const res = await sbFetch(`/sessions?select=id,name,claim_count,query_count&order=updated_at.desc&limit=500`);
      if (!res.ok) return null;
      const rows = await res.json();

      for (const row of rows) {
        const encoder = new TextEncoder();
        const data = encoder.encode(row.id);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map((b: number) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
        if (hash === shareId) {
          // Found the session — return its knowledge
          const knowledgeRes = await sbFetch(
            `/knowledge_entries?session_id=eq.${sanitizePostgrestParam(row.id)}&select=*&order=created_at.desc&limit=100`
          );
          const entries = knowledgeRes.ok ? (await knowledgeRes.json()).map(toKnowledgeEntry) : [];
          return {
            session: {
              name: row.name,
              claimCount: row.claim_count || 0,
              queryCount: row.query_count || 0,
            },
            entries,
          };
        }
      }
      return null;
    },
  };
}

export function createNoopSessionStore(): SessionStore {
  const sessions = new Map<string, Session>();
  const knowledge = new Map<string, KnowledgeEntry[]>();

  return {
    async createSession(name, userId) {
      const session: Session = {
        id: crypto.randomUUID(),
        name,
        userId,
        claimCount: 0,
        queryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sessions.set(session.id, session);
      knowledge.set(session.id, []);
      return session;
    },
    async getSession(id) { return sessions.get(id) || null; },
    async deleteSession(id) { sessions.delete(id); knowledge.delete(id); return true; },
    async listSessions() { return [...sessions.values()]; },
    async storeKnowledge(sessionId, claims, originQuery) {
      const entries = claims.filter((c) => c.sources.length > 0).map((c) => ({
        id: crypto.randomUUID(),
        sessionId,
        claim: c.claim,
        sources: c.sources,
        verified: c.verified ?? false,
        confidence: c.verificationScore ?? 0,
        originQuery,
        createdAt: new Date().toISOString(),
      }));
      const existing = knowledge.get(sessionId) || [];
      knowledge.set(sessionId, [...existing, ...entries]);
      return entries.length;
    },
    async recallKnowledge(sessionId, query, limit = 10) {
      const keywords = extractKeywords(query);
      const entries = knowledge.get(sessionId) || [];
      if (keywords.length === 0) return entries.slice(0, limit);
      const matched = entries
        .filter((e) => keywords.some((kw) => e.claim.toLowerCase().includes(kw)))
        .slice(0, limit);
      // Fall back to recent entries if keyword search found nothing
      return matched.length > 0 ? matched : entries.slice(0, limit);
    },
    async getKnowledge(sessionId, limit = 50) {
      return (knowledge.get(sessionId) || []).slice(0, limit);
    },
    async touchSession(sessionId) {
      const s = sessions.get(sessionId);
      if (s) { s.queryCount++; s.updatedAt = new Date().toISOString(); }
    },
    async shareSession(sessionId) {
      return sessionId.replace(/-/g, "").slice(0, 12);
    },
    async getSharedSession(shareId) {
      for (const [id, session] of sessions) {
        if (id.replace(/-/g, "").slice(0, 12) === shareId) {
          const entries = knowledge.get(id) || [];
          return {
            session: { name: session.name, claimCount: session.claimCount, queryCount: session.queryCount },
            entries,
          };
        }
      }
      return null;
    },
  };
}

/** Sanitize a value for PostgREST query parameters to prevent filter injection */
function sanitizePostgrestParam(value: string): string {
  // Only allow alphanumeric, hyphens, underscores (safe for IDs and UUIDs)
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

// ── Helpers ──

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "of", "in", "to",
  "for", "with", "on", "at", "from", "by", "about", "as", "into",
  "through", "during", "before", "after", "above", "below", "between",
  "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
  "neither", "each", "every", "all", "any", "few", "more", "most",
  "other", "some", "such", "no", "only", "own", "same", "than",
  "too", "very", "just", "because", "if", "when", "where", "how",
  "what", "which", "who", "whom", "this", "that", "these", "those",
  "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
  "she", "her", "it", "its", "they", "them", "their",
]);

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function toSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    name: row.name as string,
    userId: row.user_id as string | undefined,
    claimCount: (row.claim_count as number) || 0,
    queryCount: (row.query_count as number) || 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toKnowledgeEntry(row: Record<string, unknown>): KnowledgeEntry {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    claim: row.claim as string,
    sources: (row.sources as string[]) || [],
    verified: (row.verified as boolean) ?? false,
    confidence: (row.confidence as number) ?? 0,
    originQuery: row.origin_query as string,
    createdAt: row.created_at as string,
  };
}
