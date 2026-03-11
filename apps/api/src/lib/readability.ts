import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { sanitizeText } from "./sanitize.js";
import { fetchWithRetry } from "./retry.js";

export type ParsedPage = {
  title: string;
  content: string;
  excerpt: string;
  siteName: string | null;
  byline: string | null;
};

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("169.254.") ||
      hostname === "[::1]" ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) return false;
    return true;
  } catch {
    return false;
  }
}

export async function fetchAndParse(url: string): Promise<ParsedPage> {
  if (!isAllowedUrl(url)) {
    throw new Error("URL not allowed: only public http/https URLs are supported");
  }

  const res = await fetchWithRetry(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BrowseAI/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10000),
  }, { maxRetries: 1 });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  const { document } = parseHTML(html);
  const reader = new Readability(document as any);
  const article = reader.parse();

  if (!article) {
    throw new Error(`Readability could not parse ${url}`);
  }

  return {
    title: sanitizeText(article.title),
    content: sanitizeText(article.textContent),
    excerpt: sanitizeText(article.excerpt || ""),
    siteName: article.siteName ? sanitizeText(article.siteName) : null,
    byline: article.byline ? sanitizeText(article.byline) : null,
  };
}
