import { TAVILY_ENDPOINT } from "@browse/shared";
import { fetchWithRetry } from "./retry.js";

export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

export type TavilyResponse = {
  results: TavilyResult[];
  query: string;
};

/** Categorize Tavily HTTP errors with specific, actionable messages. */
function categorizeTavilyError(status: number, body: string): Error {
  if (status === 401) {
    return new Error("Invalid Tavily API key. Check your key in Settings.");
  }
  if (status === 403) {
    // 403 usually means the key is valid but the plan/trial expired
    const isExpired = /expired|trial|plan|disabled|suspended/i.test(body);
    if (isExpired) {
      return new Error("Tavily API key expired or trial ended. Upgrade your Tavily plan at app.tavily.com.");
    }
    return new Error("Tavily API key forbidden. Your key may be revoked or restricted.");
  }
  if (status === 402) {
    return new Error("Tavily API credits exhausted. Top up your account at app.tavily.com.");
  }
  if (status === 429) {
    return new Error("Tavily rate limit exceeded. Please wait a moment and try again.");
  }
  return new Error(`Tavily search failed (${status}): ${body}`);
}

export async function tavilySearch(
  query: string,
  apiKey: string,
  limit: number = 10
): Promise<TavilyResponse> {
  const res = await fetchWithRetry(TAVILY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: limit,
      include_raw_content: false,
      search_depth: "basic",
    }),
  }, { maxRetries: 2 });

  if (!res.ok) {
    const text = await res.text();
    throw categorizeTavilyError(res.status, text);
  }

  return res.json();
}

/**
 * Validate a Tavily API key by making a lightweight test search.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export async function validateTavilyKey(
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: "test",
        max_results: 1,
        include_raw_content: false,
        search_depth: "basic",
      }),
    });

    if (res.ok) return { valid: true };

    const text = await res.text();
    const err = categorizeTavilyError(res.status, text);
    return { valid: false, error: err.message };
  } catch (e: unknown) {
    return { valid: false, error: e instanceof Error ? e.message : "Network error validating Tavily key" };
  }
}
