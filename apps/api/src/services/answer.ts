import { search } from "./search.js";
import { openPage } from "./scrape.js";
import { extractKnowledge } from "../lib/gemini.js";
import { MAX_PAGE_CONTENT_LENGTH } from "@browse/shared";
import type { BrowseResult, TraceStep } from "@browse/shared";
import type { CacheService } from "./cache.js";
import type { Env } from "../config/env.js";

export async function answerQuery(
  query: string,
  env: Env,
  cache: CacheService
): Promise<BrowseResult> {
  const trace: TraceStep[] = [];

  // Step 1: Search
  const searchStart = Date.now();
  const { results: searchResults } = await search(
    query,
    env.SERP_API_KEY,
    cache
  );
  trace.push({
    step: "Search Web",
    duration_ms: Date.now() - searchStart,
    detail: `${searchResults.length} results (Tavily)`,
  });

  if (searchResults.length === 0) {
    throw new Error("No search results found");
  }

  // Step 2: Fetch pages in parallel
  const scrapeStart = Date.now();
  const pages = await Promise.allSettled(
    searchResults.slice(0, 5).map((r) => openPage(r.url, cache))
  );
  const successfulPages = pages
    .filter(
      (
        p
      ): p is PromiseFulfilledResult<
        Awaited<ReturnType<typeof openPage>>
      > => p.status === "fulfilled"
    )
    .map((p) => p.value.page);
  trace.push({
    step: "Fetch Pages",
    duration_ms: Date.now() - scrapeStart,
    detail: `${successfulPages.length} pages (Readability)`,
  });

  // Step 3: Build content for LLM
  const pageContents = successfulPages
    .map((p, i) => {
      const url = searchResults[i]?.url || "";
      return `[Source ${i + 1}] URL: ${url}\nTitle: ${p.title}\n\n${p.content.slice(0, MAX_PAGE_CONTENT_LENGTH)}`;
    })
    .join("\n\n---\n\n");

  // Step 4: Extract knowledge via LLM (OpenRouter)
  const llmStart = Date.now();
  const knowledge = await extractKnowledge(
    query,
    pageContents,
    env.OPENROUTER_API_KEY
  );
  const llmDuration = Date.now() - llmStart;

  trace.push({
    step: "Extract Claims",
    duration_ms: Math.round(llmDuration * 0.4),
    detail: `${knowledge.claims.length} claims`,
  });
  trace.push({
    step: "Build Evidence Graph",
    duration_ms: Math.round(llmDuration * 0.1),
    detail: `${knowledge.sources.length} sources`,
  });
  trace.push({
    step: "Generate Answer",
    duration_ms: Math.round(llmDuration * 0.5),
    detail: "OpenRouter",
  });

  return { ...knowledge, trace };
}
