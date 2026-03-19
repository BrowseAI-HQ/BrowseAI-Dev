import { fetchWithRetry } from "./retry.js";

const EXA_ENDPOINT = "https://api.exa.ai/search";

export type ExaResult = {
  title: string;
  url: string;
  snippet: string;
  score: number;
  publishedDate?: string;
};

/**
 * Search using Exa API (neural/semantic search).
 * Exa uses embeddings-based retrieval — finds conceptually related pages
 * that keyword-based engines (Tavily, Brave) miss entirely.
 * Returns empty array on any failure (non-fatal secondary provider).
 */
export async function exaSearch(
  query: string,
  apiKey: string,
  count: number = 10,
): Promise<ExaResult[]> {
  try {
    const res = await fetchWithRetry(EXA_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: count,
        contents: {
          highlights: { maxCharacters: 300 },
        },
      }),
    }, { maxRetries: 2 });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.results || []).map((r: {
      title?: string;
      url: string;
      highlights?: string[];
      highlightScores?: number[];
      publishedDate?: string;
    }, i: number) => ({
      title: r.title || "",
      url: r.url,
      snippet: (r.highlights || []).join(" ").slice(0, 500) || "",
      // Use highlight scores if available, otherwise position-based
      score: r.highlightScores?.[0] ?? Math.max(0.3, 1 - i * 0.07),
      publishedDate: r.publishedDate,
    }));
  } catch (e) {
    console.warn("Exa search failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
