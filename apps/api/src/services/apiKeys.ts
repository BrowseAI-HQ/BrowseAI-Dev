import {
  generateApiKey,
  hashApiKey,
  isBrowseApiKey,
  encryptValue,
  decryptValue,
} from "../lib/crypto.js";

export interface ApiKeyRecord {
  id: string;
  api_key_prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
}

export interface ResolvedKeys {
  userId: string;
  tavilyKey: string;
  openrouterKey: string;
}

export interface ApiKeyService {
  create(
    userId: string,
    tavilyKey: string,
    openrouterKey: string,
    label?: string
  ): Promise<{ apiKey: string; record: ApiKeyRecord }>;
  list(userId: string): Promise<ApiKeyRecord[]>;
  revoke(userId: string, keyId: string): Promise<boolean>;
  resolve(apiKey: string): Promise<ResolvedKeys | null>;
  /** Resolve stored keys by user ID (for auto-using keys in website UI) */
  resolveByUserId(userId: string): Promise<Omit<ResolvedKeys, "userId"> | null>;
  /** Count active (non-revoked) keys for a user */
  countActive(userId: string): Promise<number>;
  updateLastUsed(keyHash: string): Promise<void>;
}

export function createApiKeyService(
  supabaseUrl: string,
  serviceRoleKey: string,
  encryptionKey: string
): ApiKeyService {
  async function supabaseFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: options.method === "POST" ? "return=representation" : "return=minimal",
        ...options.headers,
      },
    });
    return res;
  }

  const service: ApiKeyService = {
    async create(userId, tavilyKey, openrouterKey, label = "Default") {
      const { plaintext, hash, prefix } = generateApiKey();

      const tavilyEncrypted = encryptValue(tavilyKey, encryptionKey);
      const openrouterEncrypted = encryptValue(openrouterKey, encryptionKey);

      const row = {
        user_id: userId,
        api_key_hash: hash,
        api_key_prefix: prefix,
        tavily_key_encrypted: tavilyEncrypted.ciphertext,
        tavily_key_iv: tavilyEncrypted.iv,
        openrouter_key_encrypted: openrouterEncrypted.ciphertext,
        openrouter_key_iv: openrouterEncrypted.iv,
        label,
      };

      const res = await supabaseFetch("/user_api_keys", {
        method: "POST",
        body: JSON.stringify(row),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to create API key: ${text}`);
      }

      const [created] = await res.json();

      return {
        apiKey: plaintext,
        record: {
          id: created.id,
          api_key_prefix: prefix,
          label,
          created_at: created.created_at,
          last_used_at: null,
          revoked: false,
        },
      };
    },

    async list(userId) {
      const res = await supabaseFetch(
        `/user_api_keys?user_id=eq.${userId}&revoked=eq.false&select=id,api_key_prefix,label,created_at,last_used_at,revoked&order=created_at.desc`
      );
      if (!res.ok) return [];
      return res.json();
    },

    async revoke(userId, keyId) {
      // Stripe-style: revoke + wipe credentials, keep metadata for audit
      const res = await supabaseFetch(
        `/user_api_keys?id=eq.${keyId}&user_id=eq.${userId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            revoked: true,
            tavily_key_encrypted: null,
            tavily_key_iv: null,
            openrouter_key_encrypted: null,
            openrouter_key_iv: null,
          }),
          headers: { Prefer: "return=representation" },
        }
      );
      if (!res.ok) return false;
      const rows = await res.json();
      return rows.length > 0;
    },

    async resolve(apiKey) {
      if (!isBrowseApiKey(apiKey)) return null;

      const hash = hashApiKey(apiKey);
      const res = await supabaseFetch(
        `/user_api_keys?api_key_hash=eq.${hash}&revoked=eq.false&select=user_id,tavily_key_encrypted,tavily_key_iv,openrouter_key_encrypted,openrouter_key_iv`
      );

      if (!res.ok) return null;
      const rows = await res.json();
      if (!rows.length) return null;

      const row = rows[0];

      const tavilyKey = decryptValue(
        row.tavily_key_encrypted,
        row.tavily_key_iv,
        encryptionKey
      );
      const openrouterKey = decryptValue(
        row.openrouter_key_encrypted,
        row.openrouter_key_iv,
        encryptionKey
      );

      // Fire-and-forget last_used_at update
      service.updateLastUsed(hash);

      return { userId: row.user_id, tavilyKey, openrouterKey };
    },

    async resolveByUserId(userId) {
      // Get all active keys ordered by most recently used, then most recently created
      const res = await supabaseFetch(
        `/user_api_keys?user_id=eq.${userId}&revoked=eq.false&select=api_key_hash,tavily_key_encrypted,tavily_key_iv,openrouter_key_encrypted,openrouter_key_iv&order=last_used_at.desc.nullslast,created_at.desc&limit=5`
      );

      if (!res.ok) return null;
      const rows = await res.json();
      if (!rows.length) return null;

      // Try each key in order — first one that decrypts successfully wins
      for (const row of rows) {
        try {
          const tavilyKey = decryptValue(
            row.tavily_key_encrypted,
            row.tavily_key_iv,
            encryptionKey
          );
          const openrouterKey = decryptValue(
            row.openrouter_key_encrypted,
            row.openrouter_key_iv,
            encryptionKey
          );

          if (tavilyKey && openrouterKey) {
            // Update last_used_at for the key that worked
            service.updateLastUsed(row.api_key_hash);
            return { tavilyKey, openrouterKey };
          }
        } catch {
          // Decryption failed for this key — try the next one
          continue;
        }
      }

      return null;
    },

    async countActive(userId) {
      const res = await supabaseFetch(
        `/user_api_keys?user_id=eq.${userId}&revoked=eq.false&select=id`,
        { headers: { Prefer: "count=exact" } }
      );
      if (!res.ok) return 0;
      const rows = await res.json();
      return rows.length;
    },

    async updateLastUsed(keyHash) {
      await supabaseFetch(
        `/user_api_keys?api_key_hash=eq.${keyHash}`,
        {
          method: "PATCH",
          body: JSON.stringify({ last_used_at: new Date().toISOString() }),
        }
      ).catch(() => {});
    },
  };

  return service;
}
