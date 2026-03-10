import { createHash } from "crypto";
import { openPage } from "./scrape.js";
import { extractKnowledge } from "../lib/gemini.js";
import { MAX_PAGE_CONTENT_LENGTH } from "@browse/shared";
import type { CacheService } from "./cache.js";

function hashKey(s: string): string {
  return createHash("sha256").update(s.toLowerCase().trim()).digest("hex").slice(0, 24);
}

const EXTRACT_CACHE_TTL = 3600; // 1 hour — page content doesn't change fast

export async function extractFromPage(
  url: string,
  query: string | undefined,
  apiKey: string,
  cache: CacheService
) {
  const domain = new URL(url).hostname;
  const q = query || `Summarize the content from ${domain}`;
  const cacheKey = `extract:${hashKey(url)}:${hashKey(q)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const { page } = await openPage(url, cache);
  const content = page.content.slice(0, MAX_PAGE_CONTENT_LENGTH);
  const pageContent = `[Source 1] URL: ${url}\nTitle: ${page.title}\n\n${content}`;
  const pageTexts = new Map<string, string>([[url, content]]);
  const result = await extractKnowledge(q, pageContent, apiKey, pageTexts);
  await cache.set(cacheKey, JSON.stringify(result), EXTRACT_CACHE_TTL);
  return result;
}
