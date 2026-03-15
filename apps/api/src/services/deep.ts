/**
 * Deep reasoning agent — multi-step agentic research loop.
 *
 * Unlike fast (1 pass) or thorough (2 passes with rephrase), deep mode
 * uses an iterative think→search→extract→evaluate cycle:
 *
 *   Step 1: Initial search + extraction
 *   Step 2: Gap analysis — what's missing?
 *   Step 3: Follow-up search(es) targeting gaps
 *   Step 4: Merge knowledge, re-verify
 *   Step 5: Final comprehensive answer
 *
 * Max 3 follow-up steps. Stops early if confidence is high or gaps are filled.
 */

import { LLM_ENDPOINT, LLM_MODEL } from "@browse/shared";
import type { BrowseResult, BrowseClaim, BrowseSource, TraceStep, ReasoningStep } from "@browse/shared";
import { singlePass } from "./answer.js";
import type { AnswerOptions } from "./answer.js";
import type { CacheService } from "./cache.js";
import type { Env } from "../config/env.js";
import { fetchWithRetry } from "../lib/retry.js";
import { computeConfidence } from "../lib/gemini.js";
import { verifyEvidence } from "../lib/verify.js";

const MAX_FOLLOW_UP_STEPS = 3;
const DEEP_CONFIDENCE_THRESHOLD = 0.85;

type GapAnalysisResult = {
  complete: boolean;
  gaps: string[];
  followUpQueries: string[];
};

/**
 * Analyze what's missing from the current knowledge.
 * Returns follow-up queries to fill identified gaps.
 */
async function analyzeKnowledgeGaps(
  originalQuery: string,
  currentAnswer: string,
  currentClaims: BrowseClaim[],
  currentConfidence: number,
  apiKey: string,
  previousQueries: string[],
): Promise<GapAnalysisResult> {
  try {
    const claimSummary = currentClaims
      .slice(0, 15)
      .map((c, i) => `${i + 1}. ${c.claim} [${c.verified ? "verified" : "unverified"}]`)
      .join("\n");

    const res = await fetchWithRetry(LLM_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a research gap analyzer. Given a research question and evidence gathered so far, identify what's missing and suggest exactly 1 follow-up search query.

Rules:
- Only suggest a query that would meaningfully improve the answer
- Don't repeat queries already searched (listed below)
- If the answer is comprehensive enough, set complete=true
- Be conservative — only suggest a follow-up if there's a clear factual gap
- Prefer setting complete=true over suggesting marginal follow-ups`,
          },
          {
            role: "user",
            content: `Research question: ${originalQuery}

Current confidence: ${Math.round(currentConfidence * 100)}%

Evidence gathered so far:
${claimSummary}

Current answer summary: ${currentAnswer.slice(0, 500)}

Previously searched: ${previousQueries.join("; ")}

Analyze gaps and suggest follow-up queries.`,
          },
        ],
        tools: [{
          type: "function" as const,
          function: {
            name: "report_gaps",
            description: "Report knowledge gaps and follow-up queries",
            parameters: {
              type: "object",
              properties: {
                complete: {
                  type: "boolean",
                  description: "True if the current evidence is comprehensive enough",
                },
                gaps: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of identified knowledge gaps",
                },
                followUpQueries: {
                  type: "array",
                  items: { type: "string" },
                  description: "1-2 search queries to fill the gaps",
                },
              },
              required: ["complete", "gaps", "followUpQueries"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_gaps" } },
        max_tokens: 300,
      }),
    });

    if (!res.ok) return { complete: false, gaps: [], followUpQueries: [] };

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return { complete: true, gaps: [], followUpQueries: [] };

    const result = JSON.parse(toolCall.function.arguments);
    return {
      complete: result.complete ?? false,
      gaps: (result.gaps || []).slice(0, 2),
      followUpQueries: (result.followUpQueries || []).slice(0, 1),
    };
  } catch {
    return { complete: false, gaps: [], followUpQueries: [] };
  }
}

/**
 * Merge claims from multiple passes, deduplicating by content overlap.
 */
function mergeClaims(existing: BrowseClaim[], incoming: BrowseClaim[]): BrowseClaim[] {
  const merged = [...existing];
  const OVERLAP_THRESHOLD = 0.5;

  for (const newClaim of incoming) {
    const newTokens = tokenize(newClaim.claim);
    let isDuplicate = false;

    for (const existingClaim of merged) {
      const existingTokens = tokenize(existingClaim.claim);
      const shared = newTokens.filter(t => existingTokens.includes(t));
      const overlap = shared.length / Math.max(newTokens.length, existingTokens.length, 1);

      if (overlap >= OVERLAP_THRESHOLD) {
        // Merge sources from the duplicate
        const allSources = new Set([...existingClaim.sources, ...newClaim.sources]);
        existingClaim.sources = [...allSources];
        // Keep the better verification score
        if ((newClaim.verificationScore ?? 0) > (existingClaim.verificationScore ?? 0)) {
          existingClaim.verified = newClaim.verified;
          existingClaim.verificationScore = newClaim.verificationScore;
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      merged.push(newClaim);
    }
  }

  return merged;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
}

/**
 * Merge sources from multiple passes, deduplicating by URL.
 */
function mergeSources(existing: BrowseSource[], incoming: BrowseSource[]): BrowseSource[] {
  const seen = new Set(existing.map(s => s.url));
  const merged = [...existing];
  for (const s of incoming) {
    if (!seen.has(s.url)) {
      seen.add(s.url);
      merged.push(s);
    }
  }
  return merged;
}

export type DeepEmitter = (event: string, data: unknown) => void;

/**
 * Multi-step deep research agent.
 * Runs iterative search→extract→analyze cycles until confidence is high enough
 * or knowledge gaps are filled.
 */
export async function answerQueryDeep(
  query: string,
  env: Env,
  cache: CacheService,
  sessionContext?: string,
  options?: AnswerOptions,
  emit?: DeepEmitter,
): Promise<BrowseResult> {
  const trace: TraceStep[] = [];
  const reasoningSteps: ReasoningStep[] = [];
  const previousQueries: string[] = [query];

  /** Flush any new trace steps added by singlePass to the SSE stream. */
  let lastFlushed = 0;
  function flushTrace() {
    if (!emit) return;
    for (let i = lastFlushed; i < trace.length; i++) {
      emit("trace", trace[i]);
    }
    lastFlushed = trace.length;
  }

  // Step 1: Initial pass
  const { knowledge: initial, pageTexts, queryType } = await singlePass(
    query, env, cache, trace, undefined, "step 1", undefined, sessionContext, options
  );
  flushTrace();

  reasoningSteps.push({
    step: 1,
    query,
    gapAnalysis: "Initial research pass",
    claimCount: initial.claims.length,
    confidence: initial.confidence,
  });

  if (emit) {
    emit("reasoning_step", reasoningSteps[0]);
  }

  // Early exit: high confidence on first pass
  if (initial.confidence >= DEEP_CONFIDENCE_THRESHOLD) {
    trace.push({
      step: "Deep Complete",
      duration_ms: 0,
      detail: `Confidence ${Math.round(initial.confidence * 100)}% — no follow-up needed`,
    });
    flushTrace();
    return { ...initial, trace, reasoningSteps };
  }

  // Accumulated knowledge
  let allClaims = [...initial.claims];
  let allSources = [...initial.sources];
  const allPageTexts = new Map(pageTexts);
  let bestAnswer = initial.answer;
  let bestConfidence = initial.confidence;

  // Iterative follow-up loop
  for (let step = 2; step <= MAX_FOLLOW_UP_STEPS + 1; step++) {
    // Gap analysis
    const gapStart = Date.now();
    const gaps = await analyzeKnowledgeGaps(
      query, bestAnswer, allClaims, bestConfidence,
      env.OPENROUTER_API_KEY, previousQueries,
    );

    trace.push({
      step: `Gap Analysis (step ${step})`,
      duration_ms: Date.now() - gapStart,
      detail: gaps.complete
        ? "Research complete — no significant gaps"
        : `${gaps.gaps.length} gap(s): ${gaps.gaps.join("; ")}`,
    });
    flushTrace();

    // Stop if research is complete or no follow-up queries
    if (gaps.complete || gaps.followUpQueries.length === 0) {
      trace.push({
        step: "Deep Complete",
        duration_ms: 0,
        detail: `Research converged at step ${step - 1}`,
      });
      flushTrace();
      break;
    }

    // Run follow-up searches in parallel
    previousQueries.push(...gaps.followUpQueries);

    const followUpResults = await Promise.allSettled(
      gaps.followUpQueries.map((q) =>
        singlePass(q, env, cache, trace, allPageTexts, `step ${step}`, undefined, undefined, options)
      )
    );
    flushTrace();

    for (let qi = 0; qi < followUpResults.length; qi++) {
      const result = followUpResults[qi];
      const followUpQuery = gaps.followUpQueries[qi];

      if (result.status === "fulfilled") {
        const { knowledge: followUp, pageTexts: newPageTexts } = result.value;

        // Merge knowledge
        allClaims = mergeClaims(allClaims, followUp.claims);
        allSources = mergeSources(allSources, followUp.sources);

        // Merge page texts
        for (const [url, text] of newPageTexts) {
          allPageTexts.set(url, text);
        }

        // Keep the better answer
        if (followUp.confidence > bestConfidence) {
          bestAnswer = followUp.answer;
          bestConfidence = followUp.confidence;
        }

        reasoningSteps.push({
          step,
          query: followUpQuery,
          gapAnalysis: gaps.gaps.join("; "),
          claimCount: allClaims.length,
          confidence: bestConfidence,
        });

        if (emit) {
          emit("reasoning_step", reasoningSteps[reasoningSteps.length - 1]);
        }
      } else {
        trace.push({
          step: `Follow-up Failed (step ${step})`,
          duration_ms: 0,
          detail: `Query "${followUpQuery}" failed — continuing with existing evidence`,
        });
        flushTrace();
      }
    }

    // Check if confidence is now high enough
    if (bestConfidence >= DEEP_CONFIDENCE_THRESHOLD) {
      trace.push({
        step: "Deep Complete",
        duration_ms: 0,
        detail: `Confidence ${Math.round(bestConfidence * 100)}% reached at step ${step}`,
      });
      flushTrace();
      break;
    }
  }

  // Final: re-verify merged claims against all page texts
  if (emit) emit("trace", { step: "Analyzing", duration_ms: 0, detail: "Final verification of merged evidence..." });
  const finalVerifyStart = Date.now();
  let finalResult: Omit<BrowseResult, "trace">;

  if (allPageTexts.size > 0) {
    const verification = await verifyEvidence(allClaims, allSources, allPageTexts, {
      hfApiKey: env.HF_API_KEY,
    });
    finalResult = {
      answer: bestAnswer,
      claims: verification.claims,
      sources: verification.sources,
      confidence: computeConfidence(
        allClaims, allSources,
        verification.verificationRate,
        verification.avgAuthority,
        verification.consensusScore,
        verification.contradictions.length,
        queryType,
      ),
      contradictions: verification.contradictions.length > 0
        ? verification.contradictions
        : undefined,
    };
  } else {
    finalResult = {
      answer: bestAnswer,
      claims: allClaims,
      sources: allSources,
      confidence: bestConfidence,
    };
  }

  trace.push({
    step: "Final Verification",
    duration_ms: Date.now() - finalVerifyStart,
    detail: `${allClaims.length} claims, ${allSources.length} sources across ${reasoningSteps.length} steps`,
  });
  flushTrace();

  return {
    ...finalResult,
    trace,
    reasoningSteps,
  };
}
