/**
 * Neural re-ranker using HF Inference API cross-encoder.
 * Uses cross-encoder/ms-marco-MiniLM-L-6-v2 to score query-document relevance.
 *
 * Graceful fallback: if HF fails (timeout, rate limit, etc.), returns results unchanged.
 * Premium feature: only runs when HF_API_KEY is available.
 */

import { fetchWithRetry } from "./retry.js";

const HF_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2";
const HF_ENDPOINT = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const RERANK_TIMEOUT_MS = 4000;

export interface RerankableResult {
  url: string;
  title: string;
  snippet: string;
  score: number;
  [key: string]: unknown;
}

/**
 * Re-rank search results using a cross-encoder model.
 * Sends query-document pairs to HF Inference API and sorts by relevance score.
 *
 * @param query - The user's search query
 * @param results - Search results to re-rank
 * @param hfApiKey - HuggingFace API key
 * @returns Re-ranked results (or original results on failure)
 */
export async function crossEncoderRerank<T extends RerankableResult>(
  query: string,
  results: T[],
  hfApiKey: string,
): Promise<{ results: T[]; reranked: boolean }> {
  if (results.length <= 1) return { results, reranked: false };

  try {
    // Build query-document pairs for the cross-encoder
    const inputs = results.map(r => ({
      text: query,
      text_pair: `${r.title}. ${r.snippet}`.slice(0, 512),
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS);

    const res = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      // Model loading (503), rate limit (429), etc. — fall back silently
      return { results, reranked: false };
    }

    const scores: number[] | Array<{ score: number }> | Array<Array<{ score: number; label: string }>> = await res.json();

    // HF cross-encoder returns different formats depending on the model
    // For ms-marco-MiniLM: returns array of [{ label, score }] per input
    const normalizedScores = normalizeScores(scores, results.length);
    if (!normalizedScores) return { results, reranked: false };

    // Pair results with cross-encoder scores and sort
    const paired = results.map((r, i) => ({
      result: r,
      ceScore: normalizedScores[i] ?? 0,
    }));

    paired.sort((a, b) => b.ceScore - a.ceScore);

    return {
      results: paired.map(p => p.result),
      reranked: true,
    };
  } catch {
    // Network error, timeout, etc. — graceful fallback
    return { results, reranked: false };
  }
}

/**
 * Normalize various HF response formats into a flat array of scores.
 */
function normalizeScores(
  raw: unknown,
  expectedLength: number,
): number[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length !== expectedLength) return null;

  // Format 1: flat array of numbers
  if (typeof raw[0] === "number") return raw as number[];

  // Format 2: array of { score } objects
  if (typeof raw[0] === "object" && raw[0] !== null && "score" in raw[0]) {
    return (raw as Array<{ score: number }>).map((r) => r.score);
  }

  // Format 3: array of arrays of { label, score } (classification models)
  if (Array.isArray(raw[0]) && raw[0].length > 0 && "label" in raw[0][0]) {
    return (raw as Array<Array<{ label: string; score: number }>>).map((r) => {
      // Take the score for the positive/LABEL_1 class
      const positive = r.find((c) => c.label === "LABEL_1" || c.label === "entailment");
      return positive?.score ?? r[0]?.score ?? 0;
    });
  }

  return null;
}
