/**
 * SearchProvider interface — pluggable search backends for BrowseAI Dev.
 *
 * Default: Internet search (Tavily + Brave).
 * Enterprise: Elasticsearch, Confluence, or any custom endpoint.
 *
 * The verification pipeline (BM25, consensus, confidence, contradiction detection)
 * is search-agnostic — it runs against whatever results the provider returns.
 */

import type { SearchResult } from "../services/search.js";
import { tavilySearch } from "./tavily.js";
import { braveSearch } from "./brave.js";
import { exaSearch } from "./exa.js";
import { sanitizeText } from "./sanitize.js";
import { fetchWithRetry } from "./retry.js";

// ── SSRF Protection ──

/** Validate that an endpoint URL is safe to connect to (prevents SSRF). */
function validateEndpointUrl(endpoint: string): void {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("Invalid endpoint URL");
  }

  // Must use HTTPS — no exceptions (localhost blocked in production)
  if (parsed.protocol !== "https:") {
    throw new Error("Enterprise endpoints must use HTTPS");
  }

  // Block localhost/loopback
  const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  if (isLocalhost) {
    throw new Error("Enterprise endpoints cannot target localhost");
  }

  // Block private/internal IP ranges
  const host = parsed.hostname;
  const blockedPatterns = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^169\.254\./,              // link-local
    /^0\./,                     // 0.0.0.0/8
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(host)) {
      throw new Error("Enterprise endpoints cannot target private/internal networks");
    }
  }

  // Block metadata endpoints (cloud SSRF vector)
  if (host === "169.254.169.254" || host === "metadata.google.internal") {
    throw new Error("Enterprise endpoints cannot target cloud metadata services");
  }

  // Block IPv6-mapped IPv4 addresses (e.g. ::ffff:127.0.0.1)
  if (host.includes("::ffff:")) {
    throw new Error("Enterprise endpoints cannot target IPv6-mapped IPv4 addresses");
  }

  // Block octal IP notation (e.g. 0177.0.0.1)
  if (/^0\d/.test(host)) {
    throw new Error("Enterprise endpoints cannot use octal IP notation");
  }

  // Block decimal IP notation (e.g. 2130706433 = 127.0.0.1)
  // Also catches any raw numeric IP address
  if (/^\d+$/.test(host)) {
    throw new Error("Enterprise endpoints cannot use decimal/numeric IP addresses");
  }
}

// ── Interface ──

export interface SearchProvider {
  /** Provider name (shown in trace) */
  name: string;

  /** Search for results. Returns normalized SearchResult[]. */
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

export interface SearchProviderConfig {
  /** Provider type */
  type: "tavily" | "brave" | "exa" | "elasticsearch" | "confluence" | "custom";

  /** API key or auth token for the provider */
  apiKey?: string;

  /** Endpoint URL (for elasticsearch, confluence, custom) */
  endpoint?: string;

  /** Auth header value (e.g. "Bearer xxx" or "Basic xxx") */
  authHeader?: string;

  /** Index name (for elasticsearch) */
  index?: string;

  /** Space key (for confluence) */
  spaceKey?: string;

  /** Data retention mode — "none" skips all caching and storage */
  dataRetention?: "normal" | "none";
}

// ── Built-in Providers ──

export class TavilyProvider implements SearchProvider {
  name = "tavily";
  constructor(private apiKey: string) {}

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const response = await tavilySearch(query, this.apiKey, limit);
    return response.results.map((r) => ({
      url: r.url,
      title: sanitizeText(r.title),
      snippet: sanitizeText(r.content),
      score: r.score,
    }));
  }
}

export class BraveProvider implements SearchProvider {
  name = "brave";
  constructor(private apiKey: string) {}

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const results = await braveSearch(query, this.apiKey, limit);
    return results.map((r) => ({
      url: r.url,
      title: sanitizeText(r.title),
      snippet: sanitizeText(r.description),
      score: r.score,
    }));
  }
}

export class ExaProvider implements SearchProvider {
  name = "exa";
  constructor(private apiKey: string) {}

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const results = await exaSearch(query, this.apiKey, limit);
    return results.map((r) => ({
      url: r.url,
      title: sanitizeText(r.title),
      snippet: sanitizeText(r.snippet),
      score: r.score,
    }));
  }
}

export class ElasticsearchProvider implements SearchProvider {
  name = "elasticsearch";
  constructor(
    private endpoint: string,
    private index: string,
    private authHeader?: string,
  ) {}

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authHeader) headers["Authorization"] = this.authHeader;

    const url = `${this.endpoint.replace(/\/$/, "")}/${this.index}/_search`;
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: {
          multi_match: {
            query,
            fields: ["title^2", "content", "body", "text", "description"],
            type: "best_fields",
          },
        },
        size: limit,
        _source: ["title", "url", "content", "body", "text", "description"],
      }),
    }, { maxRetries: 1 });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Elasticsearch search failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const hits = data.hits?.hits || [];

    return hits.map((hit: { _source?: Record<string, unknown>; _score?: number; _id?: string }) => {
      const src = hit._source || {};
      const content = src.content || src.body || src.text || src.description || "";
      return {
        url: (src.url as string) || `${this.endpoint}/${this.index}/${hit._id}`,
        title: sanitizeText((src.title as string) || hit._id || ""),
        snippet: sanitizeText(typeof content === "string" ? content.slice(0, 500) : ""),
        score: hit._score ? hit._score / 10 : 0.5, // normalize ES scores roughly
      };
    });
  }
}

export class ConfluenceProvider implements SearchProvider {
  name = "confluence";
  constructor(
    private endpoint: string,
    private authHeader: string,
    private spaceKey?: string,
  ) {}

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    // Sanitize inputs for CQL injection prevention
    const sanitizeCql = (s: string) => s
      .replace(/["'`\\()~=;{}]/g, " ")
      .replace(/\b(AND|OR|NOT)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const safeQuery = sanitizeCql(query);
    const cql = this.spaceKey
      ? `space = "${sanitizeCql(this.spaceKey)}" AND text ~ "${safeQuery}"`
      : `text ~ "${safeQuery}"`;

    const url = new URL(`${this.endpoint.replace(/\/$/, "")}/rest/api/content/search`);
    url.searchParams.set("cql", cql);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("expand", "body.view");

    const res = await fetchWithRetry(url.toString(), {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    }, { maxRetries: 1 });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Confluence search failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const results = data.results || [];

    return results.map((item: { title?: string; id?: string; body?: { view?: { value?: string } }; _links?: { webui?: string } }, i: number) => {
      const bodyHtml = item.body?.view?.value || "";
      // Strip HTML tags for snippet
      const bodyText = bodyHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const pageUrl = item._links?.webui
        ? `${this.endpoint}${item._links.webui}`
        : `${this.endpoint}/pages/${item.id}`;

      return {
        url: pageUrl,
        title: sanitizeText(item.title || ""),
        snippet: sanitizeText(bodyText.slice(0, 500)),
        score: Math.max(0.3, 1 - i * 0.07), // position-based scoring
      };
    });
  }
}

export class CustomEndpointProvider implements SearchProvider {
  name = "custom";
  constructor(
    private endpoint: string,
    private authHeader?: string,
  ) {}

  /**
   * Custom endpoint must return JSON matching:
   * { results: [{ url, title, snippet|content|description, score? }] }
   */
  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authHeader) headers["Authorization"] = this.authHeader;

    const res = await fetchWithRetry(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, limit }),
    }, { maxRetries: 1 });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Custom search endpoint failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const results = data.results || data.data || data;
    if (!Array.isArray(results)) {
      throw new Error("Custom search endpoint must return { results: [...] } or an array");
    }

    return results.map((r: { url?: string; title?: string; snippet?: string; content?: string; description?: string; score?: number }, i: number) => ({
      url: r.url || "",
      title: sanitizeText(r.title || ""),
      snippet: sanitizeText(r.snippet || r.content || r.description || ""),
      score: typeof r.score === "number" ? r.score : Math.max(0.3, 1 - i * 0.07),
    }));
  }
}

// ── Factory ──

export function createSearchProvider(config: SearchProviderConfig): SearchProvider {
  switch (config.type) {
    case "tavily":
      if (!config.apiKey) throw new Error("Tavily provider requires apiKey");
      return new TavilyProvider(config.apiKey);

    case "brave":
      if (!config.apiKey) throw new Error("Brave provider requires apiKey");
      return new BraveProvider(config.apiKey);

    case "exa":
      if (!config.apiKey) throw new Error("Exa provider requires apiKey");
      return new ExaProvider(config.apiKey);

    case "elasticsearch":
      if (!config.endpoint) throw new Error("Elasticsearch provider requires endpoint");
      validateEndpointUrl(config.endpoint);
      {
        const idx = config.index || "_all";
        if (!/^[a-z0-9_.*-]+$/i.test(idx)) throw new Error("Invalid Elasticsearch index name");
        return new ElasticsearchProvider(
          config.endpoint,
          idx,
          config.authHeader,
        );
      }

    case "confluence":
      if (!config.endpoint || !config.authHeader) {
        throw new Error("Confluence provider requires endpoint and authHeader");
      }
      validateEndpointUrl(config.endpoint);
      return new ConfluenceProvider(config.endpoint, config.authHeader, config.spaceKey);

    case "custom":
      if (!config.endpoint) throw new Error("Custom provider requires endpoint");
      validateEndpointUrl(config.endpoint);
      return new CustomEndpointProvider(config.endpoint, config.authHeader);

    default:
      throw new Error(`Unknown search provider: ${config.type}`);
  }
}

/**
 * Create the default search providers from environment config.
 * Returns primary (Tavily) and optional secondary (Brave).
 */
export function createDefaultProviders(serpApiKey: string, braveApiKey?: string, exaApiKey?: string): {
  primary: SearchProvider;
  secondary: SearchProvider | null;
  tertiary: SearchProvider | null;
} {
  return {
    primary: new TavilyProvider(serpApiKey),
    secondary: braveApiKey ? new BraveProvider(braveApiKey) : null,
    tertiary: exaApiKey ? new ExaProvider(exaApiKey) : null,
  };
}
