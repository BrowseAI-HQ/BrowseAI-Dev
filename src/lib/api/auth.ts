/**
 * Shared auth token cache for all API modules.
 * Deduplicates concurrent getSession() calls so parallel API requests
 * share a single Supabase roundtrip instead of each triggering their own.
 */
import { supabase } from "@/integrations/supabase/client";

let _tokenPromise: Promise<string | null> | null = null;
let _tokenExpiry = 0;

/**
 * Get a cached access token. Concurrent callers share one getSession() call.
 * Returns null if no session (unauthenticated) — callers that require auth
 * should throw; callers that optionally attach auth can proceed without it.
 */
export async function getCachedAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (_tokenPromise && now < _tokenExpiry) return _tokenPromise;

  _tokenPromise = supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token) {
      // Cache until 30s before actual expiry, or 55s if no expires_at
      const expiresAt = session.expires_at
        ? session.expires_at * 1000 - 30_000
        : now + 55_000;
      _tokenExpiry = expiresAt;
      return session.access_token;
    }
    // No session — still cache the "null" result briefly (5s) to avoid
    // hammering getSession() on pages where user is not logged in
    _tokenExpiry = now + 5_000;
    return null;
  });

  _tokenPromise.catch(() => {
    _tokenPromise = null;
    _tokenExpiry = 0;
  });

  return _tokenPromise;
}

/** Clear cached token (call on sign-out or 401 refresh) */
export function clearTokenCache() {
  _tokenPromise = null;
  _tokenExpiry = 0;
}

/** Refresh the session and update the cache. Returns new token or throws. */
export async function refreshAndCacheToken(): Promise<string> {
  clearTokenCache();
  const { data: { session } } = await supabase.auth.refreshSession();
  if (session?.access_token) {
    _tokenPromise = Promise.resolve(session.access_token);
    _tokenExpiry = session.expires_at
      ? session.expires_at * 1000 - 30_000
      : Date.now() + 55_000;
    return session.access_token;
  }
  throw new Error("Session refresh failed");
}
