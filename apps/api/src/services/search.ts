import { tavilySearch } from "../lib/tavily.js";
import { sanitizeText } from "../lib/sanitize.js";
import type { CacheService } from "./cache.js";

export type SearchResult = {
  url: string;
  title: string;
  snippet: string;
  score: number;
};

export async function search(
  query: string,
  apiKey: string,
  cache: CacheService,
  limit: number = 5
): Promise<{ results: SearchResult[]; cached: boolean }> {
  const cacheKey = `search:${query}:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) return { results: JSON.parse(cached), cached: true };

  const response = await tavilySearch(query, apiKey, limit);
  const results: SearchResult[] = response.results.map((r) => ({
    url: r.url,
    title: sanitizeText(r.title),
    snippet: sanitizeText(r.content),
    score: r.score,
  }));

  await cache.set(cacheKey, JSON.stringify(results), 600);
  return { results, cached: false };
}
