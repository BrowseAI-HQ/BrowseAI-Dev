import { fetchAndParse, type ParsedPage } from "../lib/readability.js";
import { MAX_PAGE_CONTENT_LENGTH } from "@browse/shared";
import type { CacheService } from "./cache.js";

export async function openPage(
  url: string,
  cache: CacheService
): Promise<{ page: ParsedPage; cached: boolean }> {
  const cacheKey = `page:${url}`;
  const cached = await cache.get(cacheKey);
  if (cached) return { page: JSON.parse(cached), cached: true };

  const page = await fetchAndParse(url);
  page.content = page.content.slice(0, MAX_PAGE_CONTENT_LENGTH * 2);
  await cache.set(cacheKey, JSON.stringify(page), 1800);
  return { page, cached: false };
}
