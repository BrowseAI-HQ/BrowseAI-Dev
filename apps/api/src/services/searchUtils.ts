/**
 * Shared search utilities used by both answer.ts and stream.ts pipelines.
 */

import { createHash } from "crypto";
import type { SearchResult } from "./search.js";
import { isLowQualityDomain } from "../lib/verify.js";
import type { QueryType } from "../lib/gemini.js";

export const MAX_PER_DOMAIN = 2;

/** Adaptive page count based on query type. Complex queries need more sources. */
export const ADAPTIVE_PAGE_COUNT: Record<QueryType, number> = {
  factual: 6,
  comparison: 10,
  "how-to": 6,
  "time-sensitive": 8,
  opinion: 10,
};

export function hashKey(s: string): string {
  return createHash("sha256").update(s.toLowerCase().trim()).digest("hex").slice(0, 24);
}

// Time-sensitive keywords → short TTL, everything else → longer TTL
const TIME_SENSITIVE = /\b(today|tonight|yesterday|latest|current|now|live|breaking|this week|this month|this year|price|stock|score|weather|202[4-9])\b/i;

export function getCacheTTL(query: string): number {
  return TIME_SENSITIVE.test(query) ? 300 : 1800; // 5 min vs 30 min
}

/** Filter out known low-quality domains before fetching (saves slots for better sources). */
export function filterLowQuality(results: SearchResult[]): SearchResult[] {
  return results.filter((r) => !isLowQualityDomain(r.url));
}

/**
 * Enforce domain diversity: max N results per domain, sorted by score.
 * Ensures we get perspectives from different sources rather than 5 pages from one site.
 */
export function enforceDomainDiversity(results: SearchResult[], maxPerDomain: number = MAX_PER_DOMAIN): SearchResult[] {
  const domainCounts = new Map<string, number>();
  const diverse: SearchResult[] = [];

  // Results should already be sorted by score from Tavily
  for (const r of results) {
    let domain: string;
    try { domain = new URL(r.url).hostname.replace(/^www\./, ""); } catch { continue; }
    const count = domainCounts.get(domain) || 0;
    if (count < maxPerDomain) {
      diverse.push(r);
      domainCounts.set(domain, count + 1);
    }
  }

  return diverse;
}

/**
 * Merge two sets of search results, deduplicating by URL and re-sorting by score.
 */
export function mergeSearchResults(a: SearchResult[], b: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const merged: SearchResult[] = [];
  for (const r of [...a, ...b]) {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      merged.push(r);
    }
  }
  return merged.sort((x, y) => y.score - x.score);
}
