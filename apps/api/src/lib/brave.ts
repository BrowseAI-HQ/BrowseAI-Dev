const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export type BraveResult = {
  title: string;
  url: string;
  description: string;
  score: number;
};

/**
 * Search using Brave Search API. Returns empty array on any failure.
 * Brave surfaces different results than Tavily — combining both
 * gives broader source diversity and better consensus scoring.
 */
export async function braveSearch(
  query: string,
  apiKey: string,
  count: number = 10,
): Promise<BraveResult[]> {
  try {
    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(count));

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.web?.results || []).map((r: any, i: number) => ({
      title: r.title || "",
      url: r.url,
      description: r.description || "",
      // Brave doesn't provide relevance scores; approximate from position
      score: Math.max(0.3, 1 - i * 0.07),
    }));
  } catch {
    return [];
  }
}
