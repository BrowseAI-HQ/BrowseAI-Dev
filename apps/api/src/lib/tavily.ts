import { TAVILY_ENDPOINT } from "@browse/shared";

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

export async function tavilySearch(
  query: string,
  apiKey: string,
  limit: number = 5
): Promise<TavilyResponse> {
  const res = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: limit,
      include_raw_content: false,
      search_depth: "basic",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${text}`);
  }

  return res.json();
}
