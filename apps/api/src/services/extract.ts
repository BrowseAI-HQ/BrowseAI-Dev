import { openPage } from "./scrape.js";
import { extractKnowledge } from "../lib/gemini.js";
import { MAX_PAGE_CONTENT_LENGTH } from "@browse/shared";
import type { CacheService } from "./cache.js";

export async function extractFromPage(
  url: string,
  query: string | undefined,
  apiKey: string,
  cache: CacheService
) {
  const { page } = await openPage(url, cache);
  const domain = new URL(url).hostname;
  const pageContent = `[Source 1] URL: ${url}\nTitle: ${page.title}\n\n${page.content.slice(0, MAX_PAGE_CONTENT_LENGTH)}`;
  const q = query || `Summarize the content from ${domain}`;
  return extractKnowledge(q, pageContent, apiKey);
}
