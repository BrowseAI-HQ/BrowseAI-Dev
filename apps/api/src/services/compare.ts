import { createHash } from "crypto";
import { LLM_ENDPOINT, LLM_MODEL } from "@browse/shared";
import type { BrowseResult } from "@browse/shared";
import { answerQuery } from "./answer.js";
import type { CacheService } from "./cache.js";
import type { Env } from "../config/env.js";

function hashKey(s: string): string {
  return createHash("sha256").update(s.toLowerCase().trim()).digest("hex").slice(0, 24);
}

const RAW_LLM_CACHE_TTL = 3600; // 1 hour

export interface CompareResult {
  query: string;
  raw_llm: {
    answer: string;
    sources: number;
    claims: number;
    confidence: null;
  };
  evidence_backed: {
    answer: string;
    sources: number;
    claims: number;
    confidence: number;
    citations: BrowseResult["sources"];
    claimDetails: BrowseResult["claims"];
    trace: BrowseResult["trace"];
  };
}

async function rawLLMAnswer(query: string, apiKey: string, cache: CacheService): Promise<string> {
  const cacheKey = `raw_llm:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: "Answer the question clearly and concisely." },
        { role: "user", content: query },
      ],
    }),
  });

  if (!res.ok) throw new Error(`LLM failed: ${res.status}`);
  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content || "No response";
  await cache.set(cacheKey, answer, RAW_LLM_CACHE_TTL);
  return answer;
}

export async function compareAnswers(
  query: string,
  env: Env,
  cache: CacheService
): Promise<CompareResult> {
  const [rawAnswer, evidenceResult] = await Promise.all([
    rawLLMAnswer(query, env.OPENROUTER_API_KEY, cache),
    answerQuery(query, env, cache),
  ]);

  return {
    query,
    raw_llm: {
      answer: rawAnswer,
      sources: 0,
      claims: 0,
      confidence: null,
    },
    evidence_backed: {
      answer: evidenceResult.answer,
      sources: evidenceResult.sources.length,
      claims: evidenceResult.claims.length,
      confidence: evidenceResult.confidence,
      citations: evidenceResult.sources,
      claimDetails: evidenceResult.claims,
      trace: evidenceResult.trace,
    },
  };
}
