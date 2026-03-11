/**
 * Streaming API client for SSE-based pipeline progress.
 * Connects to /browse/answer/stream and yields events as they arrive.
 */

import { supabase } from "@/integrations/supabase/client";
import type { BrowseResult } from "./browse";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface TraceEvent {
  step: string;
  duration_ms: number;
  detail?: string;
}

export interface SourcePreview {
  url: string;
  title: string;
}

export type StreamEvent =
  | { type: "trace"; data: TraceEvent }
  | { type: "sources"; data: SourcePreview[] }
  | { type: "result"; data: BrowseResult }
  | { type: "error"; data: { error: string } }
  | { type: "done" };

function getUserKeyHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const tavily = localStorage.getItem("browse_tavily_key");
  const openrouter = localStorage.getItem("browse_openrouter_key");
  if (tavily) headers["X-Tavily-Key"] = tavily;
  if (openrouter) headers["X-OpenRouter-Key"] = openrouter;
  return headers;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

/**
 * Stream a browse/answer query via SSE.
 * Calls `onEvent` for each parsed SSE event.
 * Returns the final BrowseResult (or throws on error).
 */
export async function streamAnswer(
  query: string,
  depth: "fast" | "thorough" = "fast",
  onEvent: (event: StreamEvent) => void,
): Promise<BrowseResult> {
  const authHeaders = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/browse/answer/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getUserKeyHeaders(),
      ...authHeaders,
    },
    body: JSON.stringify({ query, depth }),
  });

  // Non-SSE error (e.g. 429 rate limit, 400 bad request)
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.error || `API call failed: ${res.status}`);
    } catch (e: any) {
      if (e.message.startsWith("API call failed") || e.message !== "Unexpected end of JSON input") throw e;
      throw new Error(`API call failed: ${res.status}`);
    }
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: BrowseResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    let currentEvent = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ") && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          const event: StreamEvent =
            currentEvent === "trace" ? { type: "trace", data } :
            currentEvent === "sources" ? { type: "sources", data } :
            currentEvent === "result" ? { type: "result", data } :
            currentEvent === "error" ? { type: "error", data } :
            currentEvent === "done" ? { type: "done" } :
            { type: "done" };

          onEvent(event);

          if (currentEvent === "result") {
            finalResult = data as BrowseResult;
          }
          if (currentEvent === "error") {
            throw new Error(data.error || "Stream error");
          }
        } catch (e: any) {
          if (e.message === "Stream error" || e.message?.includes("API")) throw e;
          // Ignore JSON parse errors for incomplete data
        }
        currentEvent = "";
      } else if (line === "") {
        currentEvent = "";
      }
    }
  }

  if (!finalResult) {
    throw new Error("Stream ended without result");
  }

  (window as any).posthog?.capture("browse_query", {
    tool: "/browse/answer/stream",
    byok: !!localStorage.getItem("browse_tavily_key"),
  });

  return finalResult;
}
