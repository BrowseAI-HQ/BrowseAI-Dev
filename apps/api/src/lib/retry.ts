/**
 * Retry with exponential backoff for external API calls.
 *
 * Retries on transient failures (429, 500-599, network errors).
 * Does NOT retry on auth errors (401/403) or client errors (400).
 */

export interface RetryOptions {
  /** Max number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 500) */
  initialDelayMs?: number;
  /** Max delay in ms (default: 5000) */
  maxDelayMs?: number;
  /** Jitter factor 0-1 to randomize delays (default: 0.2) */
  jitter?: number;
  /** Custom function to decide if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  jitter: 0.2,
  isRetryable: defaultIsRetryable,
};

function defaultIsRetryable(error: unknown): boolean {
  // Network errors (fetch failures, timeouts)
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;

  // Check error message for known transient patterns
  const msg = (error as any)?.message?.toLowerCase() || "";
  if (msg.includes("rate limit")) return true;
  if (msg.includes("timeout")) return true;
  if (msg.includes("econnreset") || msg.includes("econnrefused")) return true;
  if (msg.includes("socket hang up")) return true;
  if (msg.includes("fetch failed")) return true;

  return false;
}

/** Check if an HTTP status code is retryable */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDelay(attempt: number, opts: Required<RetryOptions>): number {
  const base = Math.min(opts.initialDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
  const jitterRange = base * opts.jitter;
  return base + (Math.random() * 2 - 1) * jitterRange;
}

/**
 * Wrap an async function with retry + exponential backoff.
 *
 * Usage:
 *   const data = await withRetry(() => fetchFromTavily(query), { maxRetries: 3 });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries || !opts.isRetryable(error)) {
        throw error;
      }

      const delay = getDelay(attempt, opts);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retry-aware fetch wrapper. Automatically retries on 429/5xx responses.
 * Throws on non-retryable errors immediately.
 */
export async function fetchWithRetry(
  url: string | URL,
  init?: RequestInit,
  options?: RetryOptions,
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);

      // If response is OK or error is not retryable, return immediately
      if (response.ok || !isRetryableStatus(response.status)) {
        return response;
      }

      // Retryable HTTP error — check Retry-After header
      if (attempt < opts.maxRetries) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter
          ? Math.min(parseInt(retryAfter, 10) * 1000 || 1000, opts.maxDelayMs)
          : getDelay(attempt, opts);
        await sleep(delay);
        continue;
      }

      // Out of retries — return the error response for caller to handle
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === opts.maxRetries || !opts.isRetryable(error)) {
        throw error;
      }
      const delay = getDelay(attempt, opts);
      await sleep(delay);
    }
  }

  throw lastError;
}
