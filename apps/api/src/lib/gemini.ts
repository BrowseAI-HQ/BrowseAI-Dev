import { LLM_ENDPOINT, LLM_MODEL } from "@browse/shared";
import type { BrowseResult, BrowseClaim, BrowseSource } from "@browse/shared";
import { verifyEvidence } from "./verify.js";
import { fetchWithRetry } from "./retry.js";

export type QueryType = "factual" | "comparison" | "how-to" | "time-sensitive" | "opinion";

export type SubQuery = {
  query: string;
  intent: string; // e.g. "definition", "comparison", "evidence", "counterargument"
};

export type QueryAnalysis = {
  type: QueryType;
  subQueries: string[] | null;
  /** Richer query plan with intents per sub-query */
  plan?: SubQuery[];
};

const BASE_PROMPT = `You are a knowledge extraction engine. Given web page content, extract structured claims with source attribution and write a clear answer.

Rules:
- Use only extracted evidence from the provided sources
- Never invent or fabricate sources
- Preserve citations by linking claims to source URLs
- Explain clearly in 2-4 paragraphs
- IMPORTANT: Extract ATOMIC claims — each claim must contain exactly ONE verifiable fact. Split compound statements. For example, "Tesla had $96B revenue and 1.8M deliveries" should be TWO claims: "Tesla had $96B revenue" and "Tesla had 1.8M deliveries". This enables precise per-fact verification.

Return a JSON object using the tool provided.`;

const TYPE_PROMPT_ADDITIONS: Record<string, string> = {
  comparison: "\n- Structure the answer as a balanced comparison. Extract claims for each option being compared. Include pros and cons.",
  "how-to": "\n- Structure the answer as clear step-by-step instructions with key requirements and prerequisites.",
  "time-sensitive": "\n- Prioritize the most recent information. Include dates and timeframes for each claim.",
  opinion: "\n- Present multiple perspectives fairly. Note which sources support each viewpoint. Avoid taking sides.",
};

function getExtractionPrompt(queryType?: QueryType): string {
  if (!queryType) return BASE_PROMPT;
  const addition = TYPE_PROMPT_ADDITIONS[queryType] || "";
  return BASE_PROMPT + addition;
}

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "return_knowledge",
    description:
      "Return extracted knowledge with claims, sources, and answer",
    parameters: {
      type: "object",
      properties: {
        answer: {
          type: "string",
          description:
            "A clear, comprehensive answer to the question (2-4 paragraphs)",
        },
        claims: {
          type: "array",
          items: {
            type: "object",
            properties: {
              claim: {
                type: "string",
                description:
                  "A specific factual claim extracted from the sources",
              },
              sources: {
                type: "array",
                items: { type: "string" },
                description: "URLs that support this claim",
              },
            },
            required: ["claim", "sources"],
          },
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              url: { type: "string" },
              title: { type: "string" },
              domain: { type: "string" },
              quote: {
                type: "string",
                description: "A key quote from this source",
              },
            },
            required: ["url", "title", "domain", "quote"],
          },
        },
      },
      required: ["answer", "claims", "sources"],
      additionalProperties: false,
    },
  },
};

// ─── Source Recency Scoring ───────────────────────────────────────────
// Computes how fresh the sources are. Time-sensitive queries get penalized
// heavily for stale sources; factual queries are more lenient.

/**
 * Compute a recency score (0-1) for a set of sources based on publication dates.
 * Returns 0.5 (neutral) when no dates are available.
 *
 * Scoring:
 * - Sources < 6 months old: 1.0
 * - Sources 6-12 months old: 0.8
 * - Sources 1-2 years old: 0.6
 * - Sources 2-5 years old: 0.4
 * - Sources > 5 years old: 0.2
 *
 * Time-sensitive queries apply stricter thresholds.
 */
export function computeRecencyScore(
  sources: BrowseSource[],
  queryType?: QueryType,
): number {
  const now = Date.now();
  const datedSources = sources.filter(s => s.publishedDate);

  // No dates available — neutral score (don't penalize or boost)
  if (datedSources.length === 0) return 0.5;

  const isTimeSensitive = queryType === "time-sensitive";

  let totalScore = 0;
  for (const source of datedSources) {
    const pubDate = new Date(source.publishedDate!).getTime();
    const ageMonths = (now - pubDate) / (1000 * 60 * 60 * 24 * 30);

    let score: number;
    if (isTimeSensitive) {
      // Stricter: time-sensitive queries need very fresh sources
      if (ageMonths < 3) score = 1.0;
      else if (ageMonths < 6) score = 0.7;
      else if (ageMonths < 12) score = 0.4;
      else score = 0.2;
    } else {
      if (ageMonths < 6) score = 1.0;
      else if (ageMonths < 12) score = 0.8;
      else if (ageMonths < 24) score = 0.6;
      else if (ageMonths < 60) score = 0.4;
      else score = 0.2;
    }

    totalScore += score;
  }

  // Blend: weighted average of dated sources + neutral for undated
  const datedAvg = totalScore / datedSources.length;
  const undatedCount = sources.length - datedSources.length;
  const blended = (datedAvg * datedSources.length + 0.5 * undatedCount) / sources.length;

  return Math.round(blended * 100) / 100;
}

/**
 * Compute confidence from real evidence signals instead of LLM self-assessment.
 *
 * 8-factor model (each contributes a weighted portion):
 *   1. Source count       (15%) — more sources = more corroboration
 *   2. Domain diversity   (10%) — claims backed by different domains are stronger
 *   3. Claim grounding    (10%) — % of claims that cite at least one source
 *   4. Citation depth     (5%)  — avg citations per claim
 *   5. Verification rate  (22%) — % of claims verified in actual source text
 *   6. Domain authority   (18%) — quality/trustworthiness of source domains
 *   7. Consensus score    (12%) — cross-source agreement across independent domains
 *   8. Source recency     (8%)  — freshness of source material
 *
 * Penalty: contradictions reduce confidence (each detected contradiction
 * subtracts 0.05 from the raw score before scaling).
 *
 * Range: 0.10 (unverified, unknown sources) → 0.97 (verified, multi-source consensus)
 */
export function computeConfidence(
  claims: BrowseClaim[],
  sources: BrowseSource[],
  verificationRate: number = 0,
  avgAuthority: number = 0.5,
  consensusScore: number = 0,
  contradictionCount: number = 0,
  queryType?: QueryType,
  adaptiveWeights?: { source: number; domain: number; grounding: number; depth: number; verification: number; authority: number; consensus: number },
  recencyScore: number = 0.5,
): number {
  if (sources.length === 0) return 0.10;
  if (claims.length === 0) return 0.25;

  // 1. Source count score — diminishing returns via log curve
  const sourceScore = Math.min(1, Math.log2(sources.length + 1) / 3);

  // 2. Domain diversity — unique domains / total sources
  const uniqueDomains = new Set(sources.map((s) => s.domain)).size;
  const domainScore = Math.min(1, uniqueDomains / Math.max(sources.length, 1));

  // 3. Claim grounding — fraction of claims that cite at least one source
  const groundedClaims = claims.filter(
    (c) => c.sources && c.sources.length > 0,
  ).length;
  const groundingScore = groundedClaims / claims.length;

  // 4. Citation depth — avg sources per claim, capped at 3
  const totalCitations = claims.reduce(
    (sum, c) => sum + (c.sources?.length || 0),
    0,
  );
  const avgCitations = totalCitations / claims.length;
  const depthScore = Math.min(1, avgCitations / 3);

  // 5. Verification — % of claims whose text was found in cited source pages
  const verificationScoreVal = verificationRate;

  // 6. Domain authority — avg trustworthiness of source domains
  const authorityScore = avgAuthority;

  // 7. Consensus — cross-source agreement
  const consensusVal = consensusScore;

  // 8. Source recency — freshness of evidence
  const recencyVal = recencyScore;

  // Query-type-aware weights:
  // Factual queries: consensus and source count matter more than BM25 text matching.
  // Time-sensitive queries: recency weight is boosted.
  // Opinion/comparison queries: verification rate stays high.
  //
  // Adaptive weights override defaults when the self-learning engine has
  // accumulated enough data (20+ queries of this type + feedback signals).
  // Note: adaptive weights from learning engine don't include recency yet,
  // so we apply recency separately when adaptive weights are used.
  const isFactual = queryType === "factual";
  const isTimeSensitive = queryType === "time-sensitive";

  let raw: number;
  if (adaptiveWeights) {
    // Adaptive weights are 7-factor; apply recency as a separate 8% factor
    // by scaling the 7 adaptive weights down to 92% total
    const scale = 0.92;
    raw =
      sourceScore * adaptiveWeights.source * scale +
      domainScore * adaptiveWeights.domain * scale +
      groundingScore * adaptiveWeights.grounding * scale +
      depthScore * adaptiveWeights.depth * scale +
      verificationScoreVal * adaptiveWeights.verification * scale +
      authorityScore * adaptiveWeights.authority * scale +
      consensusVal * adaptiveWeights.consensus * scale +
      recencyVal * 0.08;
  } else {
    const weights = isTimeSensitive
      ? { source: 0.12, domain: 0.08, grounding: 0.08, depth: 0.04, verification: 0.20, authority: 0.15, consensus: 0.12, recency: 0.21 }
      : isFactual
        ? { source: 0.18, domain: 0.09, grounding: 0.09, depth: 0.05, verification: 0.09, authority: 0.18, consensus: 0.24, recency: 0.08 }
        : { source: 0.14, domain: 0.09, grounding: 0.09, depth: 0.05, verification: 0.22, authority: 0.18, consensus: 0.14, recency: 0.09 };

    raw =
      sourceScore * weights.source +
      domainScore * weights.domain +
      groundingScore * weights.grounding +
      depthScore * weights.depth +
      verificationScoreVal * weights.verification +
      authorityScore * weights.authority +
      consensusVal * weights.consensus +
      recencyVal * weights.recency;
  }

  // Contradiction penalty: each contradiction reduces confidence
  if (contradictionCount > 0) {
    raw = Math.max(0, raw - contradictionCount * 0.05);
  }

  // Scale to 0.10–0.97 range
  const scaled = 0.10 + raw * 0.87;

  // Apply calibration adjustment if enough feedback data exists
  const calibrated = applyCalibration(scaled);

  return Math.round(calibrated * 100) / 100;
}

// ─── Auto-Calibration ──────────────────────────────────────────────
// Adjusts predicted confidence based on feedback data.
// Uses isotonic regression: if we're consistently overconfident in a range,
// pull scores down; if underconfident, push up.
// The calibration map is loaded from feedback data and refreshed periodically.

interface CalibrationPoint {
  predicted: number;  // avg predicted confidence in bucket
  actual: number;     // actual accuracy from feedback (good / (good + wrong))
  weight: number;     // number of feedback samples
}

let calibrationMap: CalibrationPoint[] = [];
let calibrationLoaded = false;
const MIN_CALIBRATION_SAMPLES = 20; // Need at least 20 feedback samples to calibrate

/**
 * Load calibration data from store. Called periodically (e.g., on startup or
 * after enough new feedback). Safe to call multiple times — updates in-place.
 */
export function setCalibrationData(buckets: Array<{
  avgConfidence: number;
  accuracy: number;
  count: number;
}>) {
  const totalSamples = buckets.reduce((sum, b) => sum + b.count, 0);
  if (totalSamples < MIN_CALIBRATION_SAMPLES) {
    calibrationMap = [];
    calibrationLoaded = false;
    return;
  }

  // Build calibration points from buckets with enough data (>=3 feedback samples)
  calibrationMap = buckets
    .filter(b => b.count >= 3 && !isNaN(b.accuracy))
    .map(b => ({
      predicted: b.avgConfidence,
      actual: b.accuracy,
      weight: b.count,
    }))
    .sort((a, b) => a.predicted - b.predicted);

  calibrationLoaded = calibrationMap.length >= 2;
}

/**
 * Apply calibration adjustment to a raw confidence score.
 * Uses linear interpolation between calibration points.
 * If no calibration data, returns the score unchanged.
 */
function applyCalibration(score: number): number {
  if (!calibrationLoaded || calibrationMap.length < 2) return score;

  // Find surrounding calibration points
  const first = calibrationMap[0];
  const last = calibrationMap[calibrationMap.length - 1];

  // Extrapolate if outside calibration range
  if (score <= first.predicted) {
    const ratio = first.actual / first.predicted;
    return Math.max(0.10, Math.min(0.97, score * ratio));
  }
  if (score >= last.predicted) {
    const ratio = last.actual / last.predicted;
    return Math.max(0.10, Math.min(0.97, score * ratio));
  }

  // Interpolate between two nearest calibration points
  for (let i = 0; i < calibrationMap.length - 1; i++) {
    const lo = calibrationMap[i];
    const hi = calibrationMap[i + 1];
    if (score >= lo.predicted && score <= hi.predicted) {
      const t = (score - lo.predicted) / (hi.predicted - lo.predicted);
      const calibrated = lo.actual + t * (hi.actual - lo.actual);
      // Blend: 70% calibrated + 30% original (smooth adjustment, not jarring)
      return Math.max(0.10, Math.min(0.97, calibrated * 0.7 + score * 0.3));
    }
  }

  return score;
}

/**
 * Rephrase a query to get better search results on a second pass.
 * Used by thorough mode when first-pass confidence is below threshold.
 */
export async function rephraseQuery(
  originalQuery: string,
  apiKey: string,
): Promise<string> {
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
          content: "You rephrase search queries to find better results. Return ONLY the rephrased query, nothing else. Make it more specific or use alternative terms.",
        },
        {
          role: "user",
          content: `Rephrase this search query for better web results:\n"${originalQuery}"`,
        },
      ],
      max_tokens: 100,
    }),
  });

  if (!res.ok) return originalQuery;
  const data = await res.json();
  const rephrased = data.choices?.[0]?.message?.content?.trim();
  return rephrased && rephrased.length > 5 ? rephrased.replace(/^["']|["']$/g, "") : originalQuery;
}

/**
 * Generate a search query variant for broader coverage.
 * Uses different phrasing/terms to surface results the original query might miss.
 * Lightweight call — returns original query on any failure.
 */
export async function generateQueryVariant(
  originalQuery: string,
  apiKey: string,
): Promise<string> {
  try {
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
            content: "Generate an alternative search query that would find complementary results. Use different keywords, synonyms, or angles. Return ONLY the query, nothing else.",
          },
          {
            role: "user",
            content: originalQuery,
          },
        ],
        max_tokens: 80,
      }),
    });

    if (!res.ok) return originalQuery;
    const data = await res.json();
    const variant = data.choices?.[0]?.message?.content?.trim();
    return variant && variant.length > 3 ? variant.replace(/^["']|["']$/g, "") : originalQuery;
  } catch {
    return originalQuery;
  }
}

/**
 * Classify query type and optionally decompose into sub-queries.
 * Runs in parallel with search — no added latency.
 *
 * Query types determine:
 * - Extraction prompt (comparison → pros/cons, how-to → steps, etc.)
 * - Adaptive page count (factual → fewer, comparison → more)
 *
 * Sub-queries: complex multi-part questions are broken into 2-3 focused
 * searches, run in parallel, then merged for broader evidence coverage.
 */
export async function analyzeQuery(
  query: string,
  apiKey: string,
): Promise<QueryAnalysis> {
  try {
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
            content: `You are a research query planner. Analyze the query and create a search plan.

Query types:
- factual: Single-answer questions (definitions, dates, numbers, "what is X")
- comparison: Comparing two or more things ("X vs Y", "pros and cons", "difference between")
- how-to: Step-by-step instructions or processes ("how to", "tutorial", "guide")
- time-sensitive: Current events, prices, scores, weather ("latest", "current", "today", year mentions)
- opinion: Subjective topics with multiple valid perspectives ("best", "should I", "is X worth")

Query plan: For complex questions, create 2-4 focused sub-queries with intent labels. Each sub-query should target a different aspect of the question to maximize source diversity. For simple factual questions, return an empty plan.

Intent types:
- definition: Core concept explanation
- evidence: Supporting data, stats, or examples
- comparison: Side-by-side analysis
- counterargument: Opposing viewpoints or limitations
- technical: Implementation details, specifications
- historical: Background, timeline, evolution`,
          },
          { role: "user", content: query },
        ],
        tools: [{
          type: "function" as const,
          function: {
            name: "plan_query",
            description: "Create a research plan for the query",
            parameters: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["factual", "comparison", "how-to", "time-sensitive", "opinion"],
                },
                plan: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      query: { type: "string", description: "Focused sub-query for search" },
                      intent: { type: "string", description: "What this sub-query targets: definition, evidence, comparison, counterargument, technical, historical" },
                    },
                    required: ["query", "intent"],
                  },
                  description: "Research plan: 2-4 focused sub-queries for complex questions, empty array for simple ones",
                },
              },
              required: ["type", "plan"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "plan_query" } },
        max_tokens: 300,
      }),
    });

    if (!res.ok) return { type: "factual", subQueries: null };

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return { type: "factual", subQueries: null };

    const result = JSON.parse(toolCall.function.arguments);
    const plan: SubQuery[] = (result.plan || []).slice(0, 4);
    return {
      type: result.type || "factual",
      subQueries: plan.length > 0 ? plan.map((p: SubQuery) => p.query) : null,
      plan: plan.length > 0 ? plan : undefined,
    };
  } catch {
    return { type: "factual", subQueries: null };
  }
}

// ─── Atomic Claim Decomposition ─────────────────────────────────────
// Splits compound claims into individual atomic claims for finer-grained
// verification. A compound claim like "Tesla had $96B revenue and 1.8M
// deliveries" becomes two atomic claims, each independently verifiable.
//
// Two-tier approach:
//   1. LLM decomposition (preferred) — catches implicit compounds, relative
//      clauses, and nested facts that regex misses.
//   2. Regex fallback — fast, deterministic, used when LLM is unavailable.

const COMPOUND_SPLITTERS = [
  /\band\b/i,           // "X and Y"
  /;\s*/,               // "X; Y"
  /,\s*(?:while|whereas|but|although|however)\s+/i, // "X, while Y"
];

const MIN_ATOMIC_LENGTH = 15; // Don't split into fragments shorter than this

/** Fast regex-based decomposition (fallback). */
function regexDecomposeCompoundClaims(claims: BrowseClaim[]): BrowseClaim[] {
  const result: BrowseClaim[] = [];

  for (const claim of claims) {
    const text = claim.claim.trim();

    // Skip short claims — already atomic
    if (text.length < 40) {
      result.push(claim);
      continue;
    }

    // Try to split on compound conjunctions
    let split = false;
    for (const pattern of COMPOUND_SPLITTERS) {
      const parts = text.split(pattern).map(p => p.trim()).filter(p => p.length >= MIN_ATOMIC_LENGTH);
      if (parts.length >= 2 && parts.length <= 4) {
        const allValid = parts.every(p => /[a-z]/i.test(p) && p.length >= MIN_ATOMIC_LENGTH);
        if (allValid) {
          for (const part of parts) {
            result.push({
              ...claim,
              claim: part.charAt(0).toUpperCase() + part.slice(1),
            });
          }
          split = true;
          break;
        }
      }
    }

    if (!split) {
      result.push(claim);
    }
  }

  return result;
}

/**
 * LLM-based claim decomposition — catches what regex misses:
 * - Implicit compounds: "Tesla's revenue grew 20%, exceeding analyst expectations"
 * - Nested facts: "The product, which launched in 30 countries, generated $5B"
 * - Relative clauses: "The study found X, making it the largest of its kind"
 * - Numeric lists: "Revenue was $10B, profit $2B, and margins 20%"
 *
 * Only processes claims that look potentially compound (length > 50 chars).
 * Falls back to regex on any LLM failure.
 */
async function llmDecomposeCompoundClaims(
  claims: BrowseClaim[],
  apiKey: string,
): Promise<BrowseClaim[]> {
  // Separate short/simple claims (already atomic) from candidates
  const atomic: BrowseClaim[] = [];
  const candidates: { index: number; claim: BrowseClaim }[] = [];

  for (let i = 0; i < claims.length; i++) {
    const text = claims[i].claim.trim();
    // Heuristic: claims under 50 chars or without compound indicators are likely atomic
    const hasCompoundSignal = text.length > 50 && (
      /\band\b/i.test(text) ||
      /;\s/.test(text) ||
      /,\s*(?:which|making|while|whereas|with|resulting|leading|exceeding|bringing|reaching)/i.test(text) ||
      /,\s*\w+ing\b/i.test(text) ||  // participial phrases: ", generating", ", reaching"
      (text.match(/\d+/g)?.length ?? 0) >= 3  // multiple numbers often = multiple facts
    );

    if (hasCompoundSignal) {
      candidates.push({ index: i, claim: claims[i] });
    } else {
      atomic.push(claims[i]);
    }
  }

  // If no candidates, return as-is
  if (candidates.length === 0) return claims;

  try {
    const claimTexts = candidates.map((c, i) => `${i + 1}. ${c.claim.claim}`).join("\n");

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
            content: `You decompose compound claims into atomic, independently verifiable facts.

Rules:
- Each output claim must contain exactly ONE verifiable fact
- Preserve the original meaning — do not add or remove information
- Keep each claim self-contained (reader should understand it without context)
- If a claim is already atomic, return it unchanged
- Return the result using the tool provided`,
          },
          {
            role: "user",
            content: `Decompose these claims into atomic facts:\n\n${claimTexts}`,
          },
        ],
        tools: [{
          type: "function" as const,
          function: {
            name: "return_atomic_claims",
            description: "Return decomposed atomic claims grouped by original claim index",
            parameters: {
              type: "object",
              properties: {
                decomposed: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      original_index: { type: "number", description: "1-based index of the original claim" },
                      atomic_claims: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of atomic claims derived from the original",
                      },
                    },
                    required: ["original_index", "atomic_claims"],
                  },
                },
              },
              required: ["decomposed"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_atomic_claims" } },
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      // LLM failed — fall back to regex
      return regexDecomposeCompoundClaims(claims);
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return regexDecomposeCompoundClaims(claims);

    const parsed = JSON.parse(toolCall.function.arguments);
    const decomposed: Array<{ original_index: number; atomic_claims: string[] }> = parsed.decomposed || [];

    // Build a map of original index → atomic claims
    const decomposedMap = new Map<number, string[]>();
    for (const d of decomposed) {
      if (d.atomic_claims && d.atomic_claims.length > 0) {
        decomposedMap.set(d.original_index, d.atomic_claims);
      }
    }

    // Reconstruct: atomic claims keep original sources
    const result: BrowseClaim[] = [...atomic];
    for (const candidate of candidates) {
      const idx = candidates.indexOf(candidate) + 1; // 1-based
      const atomicClaims = decomposedMap.get(idx);

      if (atomicClaims && atomicClaims.length > 1) {
        for (const ac of atomicClaims) {
          const trimmed = ac.trim();
          if (trimmed.length >= MIN_ATOMIC_LENGTH) {
            result.push({
              ...candidate.claim,
              claim: trimmed,
            });
          }
        }
      } else {
        // LLM said it's already atomic, or no decomposition returned
        result.push(candidate.claim);
      }
    }

    return result;
  } catch (e) {
    console.warn("LLM claim decomposition failed, using regex fallback:", e instanceof Error ? e.message : e);
    return regexDecomposeCompoundClaims(claims);
  }
}

/**
 * Decompose compound claims into atomic claims.
 * Uses LLM when API key is available, falls back to regex.
 */
async function decomposeCompoundClaims(
  claims: BrowseClaim[],
  apiKey?: string,
): Promise<BrowseClaim[]> {
  if (apiKey) {
    return llmDecomposeCompoundClaims(claims, apiKey);
  }
  return regexDecomposeCompoundClaims(claims);
}

export async function extractKnowledge(
  query: string,
  pageContents: string,
  apiKey: string,
  pageTexts?: Map<string, string>,
  queryType?: QueryType,
  sessionContext?: string,
  adaptiveOptions?: {
    bm25Threshold?: number;
    consensusThreshold?: number;
    weights?: { source: number; domain: number; grounding: number; depth: number; verification: number; authority: number; consensus: number };
    hfApiKey?: string;
    embeddingApiKey?: string;
  },
  pageDates?: Map<string, string>,
): Promise<Omit<BrowseResult, "trace">> {
  const systemPrompt = getExtractionPrompt(queryType);

  // Build user message — include session context if available so the LLM
  // can resolve ambiguous references ("it", "the best", "compare this" etc.)
  let userContent = `Question: ${query}\n\nWeb sources:\n${pageContents}`;
  if (sessionContext) {
    userContent = `Question: ${query}\n\nPrior research context (use this to understand what the question refers to):\n${sessionContext}\n\nWeb sources:\n${pageContents}`;
  }

  const res = await fetchWithRetry(LLM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: userContent,
        },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: {
        type: "function",
        function: { name: "return_knowledge" },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error("Invalid LLM API key. Check your OpenRouter key in Settings.");
    }
    if (res.status === 429)
      throw new Error("Rate limit exceeded. Please try again later.");
    if (res.status === 402) throw new Error("OpenRouter credits exhausted. Top up your account at openrouter.ai.");
    throw new Error(`LLM API failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("LLM did not return structured output");

  let knowledge;
  try {
    knowledge = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error("Failed to parse LLM output");
  }

  const rawClaims: BrowseClaim[] = knowledge.claims || [];
  const sources: BrowseSource[] = knowledge.sources || [];

  // Attach publication dates to sources from scraped page metadata
  if (pageDates && pageDates.size > 0) {
    for (const source of sources) {
      const date = pageDates.get(source.url);
      if (date) source.publishedDate = date;
    }
  }

  // Compute source recency score (0-1) for confidence adjustment
  const recencyScore = computeRecencyScore(sources, queryType);

  // Atomic claim decomposition: split compound claims the LLM missed
  const claims = await decomposeCompoundClaims(rawClaims, apiKey);

  // Run post-extraction verification if page texts are available
  if (pageTexts && pageTexts.size > 0) {
    const verification = await verifyEvidence(claims, sources, pageTexts, {
      bm25Threshold: adaptiveOptions?.bm25Threshold,
      consensusThreshold: adaptiveOptions?.consensusThreshold,
      hfApiKey: adaptiveOptions?.hfApiKey,
      embeddingApiKey: adaptiveOptions?.embeddingApiKey,
    });
    return {
      answer: knowledge.answer,
      claims: verification.claims,
      sources: verification.sources,
      confidence: computeConfidence(
        claims,
        sources,
        verification.verificationRate,
        verification.avgAuthority,
        verification.consensusScore,
        verification.contradictions.length,
        queryType,
        adaptiveOptions?.weights,
        recencyScore,
      ),
      contradictions: verification.contradictions.length > 0
        ? verification.contradictions
        : undefined,
    };
  }

  return {
    answer: knowledge.answer,
    claims,
    sources,
    confidence: computeConfidence(claims, sources, 0, 0.5, 0, 0, queryType, undefined, recencyScore),
  };
}

/**
 * Stream answer generation — two-phase approach:
 * Phase A: Stream answer text token-by-token (standard chat completion with stream: true)
 * Phase B: Extract claims/sources via tool call (non-streamed, reuses extractKnowledge logic)
 *
 * The token callback fires for each text chunk, giving real-time answer rendering.
 * Claims, sources, confidence arrive at the end as a complete object.
 */
export async function streamAnswer(
  query: string,
  pageContents: string,
  apiKey: string,
  tokenCallback: (token: string) => void,
  pageTexts?: Map<string, string>,
  queryType?: QueryType,
  adaptiveOptions?: {
    bm25Threshold?: number;
    consensusThreshold?: number;
    weights?: { source: number; domain: number; grounding: number; depth: number; verification: number; authority: number; consensus: number };
    hfApiKey?: string;
    embeddingApiKey?: string;
  },
  onPhase?: (phase: "extract_claims" | "verify_evidence" | "consensus" | "build_graph" | "done") => void,
): Promise<Omit<BrowseResult, "trace">> {
  const systemPrompt = getExtractionPrompt(queryType);

  // Phase A: Stream the answer text
  const streamRes = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      stream: true,
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nIMPORTANT: Write ONLY the answer text (2-4 paragraphs). Do NOT output JSON, claims, or sources — those will be extracted separately. Focus on a clear, well-cited answer using [Source N] references.`,
        },
        {
          role: "user",
          content: `Question: ${query}\n\nWeb sources:\n${pageContents}`,
        },
      ],
      max_tokens: 1500,
    }),
  });

  if (!streamRes.ok) {
    // Fall back to non-streaming extractKnowledge
    return extractKnowledge(query, pageContents, apiKey, pageTexts, queryType, undefined, adaptiveOptions);
  }

  // Read SSE stream and emit tokens
  let fullAnswer = "";
  const reader = streamRes.body?.getReader();
  if (!reader) {
    return extractKnowledge(query, pageContents, apiKey, pageTexts, queryType, undefined, adaptiveOptions);
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            fullAnswer += token;
            tokenCallback(token);
          }
        } catch {
          // Skip malformed SSE chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Phase B: Extract claims + sources (non-streamed, tool call)
  onPhase?.("extract_claims");
  const extractRes = await fetchWithRetry(LLM_ENDPOINT, {
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
          content: "Extract claims with source attribution from the answer and source pages. Each claim must be atomic (one verifiable fact). Return structured data using the tool.",
        },
        {
          role: "user",
          content: `Question: ${query}\n\nAnswer:\n${fullAnswer}\n\nWeb sources:\n${pageContents}`,
        },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: {
        type: "function",
        function: { name: "return_knowledge" },
      },
    }),
  });

  if (!extractRes.ok) {
    // If extraction fails, return the streamed answer with empty claims
    return {
      answer: fullAnswer || "Failed to generate answer.",
      claims: [],
      sources: [],
      confidence: 0.15,
    };
  }

  const extractData = await extractRes.json();
  const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall) {
    return {
      answer: fullAnswer,
      claims: [],
      sources: [],
      confidence: 0.15,
    };
  }

  let knowledge;
  try {
    knowledge = JSON.parse(toolCall.function.arguments);
  } catch {
    return { answer: fullAnswer, claims: [], sources: [], confidence: 0.15 };
  }

  const rawClaims: BrowseClaim[] = knowledge.claims || [];
  const sources: BrowseSource[] = knowledge.sources || [];
  const claims = await decomposeCompoundClaims(rawClaims, apiKey);

  // Run verification if page texts are available
  if (pageTexts && pageTexts.size > 0) {
    onPhase?.("verify_evidence");
    const verification = await verifyEvidence(claims, sources, pageTexts, {
      bm25Threshold: adaptiveOptions?.bm25Threshold,
      consensusThreshold: adaptiveOptions?.consensusThreshold,
      hfApiKey: adaptiveOptions?.hfApiKey,
      embeddingApiKey: adaptiveOptions?.embeddingApiKey,
    });
    onPhase?.("done");
    return {
      answer: fullAnswer,
      claims: verification.claims,
      sources: verification.sources,
      confidence: computeConfidence(
        claims, sources,
        verification.verificationRate,
        verification.avgAuthority,
        verification.consensusScore,
        verification.contradictions.length,
        queryType,
        adaptiveOptions?.weights,
      ),
      contradictions: verification.contradictions.length > 0
        ? verification.contradictions
        : undefined,
    };
  }

  return {
    answer: fullAnswer,
    claims,
    sources,
    confidence: computeConfidence(claims, sources),
  };
}

// ─── Per-Claim Evidence Retrieval (SAFE-inspired) ───────────────────
// Generates targeted search queries for low-confidence claims.
// Instead of verifying all claims against the same corpus, each claim
// gets its own focused search query for better evidence matching.

/**
 * Generate targeted search queries for claims that need more evidence.
 * Returns a query per claim (or null if claim is already well-supported).
 */
export async function generateClaimQueries(
  claims: Array<{ claim: string; verified?: boolean; verificationScore?: number }>,
  apiKey: string,
): Promise<Array<{ claim: string; query: string } | null>> {
  // Only generate queries for weak claims (not verified or low score)
  const weakClaims = claims.filter(
    (c) => !c.verified || (c.verificationScore !== undefined && c.verificationScore < 0.5)
  );

  if (weakClaims.length === 0) return claims.map(() => null);

  try {
    const claimList = weakClaims
      .map((c, i) => `${i + 1}. "${c.claim}"`)
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
            content: `You generate targeted web search queries to find evidence for specific claims. For each claim, produce a precise search query that would find authoritative sources to verify or refute it. Return a JSON array of objects with "index" (1-based) and "query" fields. Return ONLY the JSON array.`,
          },
          {
            role: "user",
            content: `Generate search queries to find evidence for these claims:\n${claimList}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return claims.map(() => null);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    // Parse JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return claims.map(() => null);

    const queries = JSON.parse(jsonMatch[0]) as Array<{ index: number; query: string }>;

    // Map back to full claims array
    const weakClaimSet = new Set(weakClaims.map((c) => c.claim));
    return claims.map((c) => {
      if (!weakClaimSet.has(c.claim)) return null;
      const weakIdx = weakClaims.findIndex((wc) => wc.claim === c.claim);
      const match = queries.find((q) => q.index === weakIdx + 1);
      return match ? { claim: c.claim, query: match.query } : null;
    });
  } catch {
    return claims.map(() => null);
  }
}

// ─── Counter-Query Verification (SANCTUARY-inspired) ────────────────
// Generates adversarial "what would disprove this?" queries to stress-test claims.
// If contradicting evidence is found via counter-search, confidence is lowered.

/**
 * Generate counter-queries that would find evidence AGAINST claims.
 * Used to strengthen contradiction detection beyond same-corpus checking.
 */
export async function generateCounterQueries(
  claims: Array<{ claim: string; verified?: boolean }>,
  apiKey: string,
): Promise<Array<{ claim: string; counterQuery: string } | null>> {
  // Only counter-check verified claims (challenge the positives)
  const verifiedClaims = claims.filter((c) => c.verified);

  if (verifiedClaims.length === 0) return claims.map(() => null);

  // Limit to top 5 to control cost
  const toCheck = verifiedClaims.slice(0, 5);

  try {
    const claimList = toCheck
      .map((c, i) => `${i + 1}. "${c.claim}"`)
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
            content: `You generate adversarial search queries designed to find evidence that CONTRADICTS or DISPROVES a given claim. The goal is to stress-test claims by actively seeking counter-evidence. For each claim, produce a search query that would find opposing data, corrections, or debunking. Return a JSON array of objects with "index" (1-based) and "counterQuery" fields. Return ONLY the JSON array.`,
          },
          {
            role: "user",
            content: `Generate counter-evidence search queries for these claims:\n${claimList}`,
          },
        ],
        max_tokens: 400,
        temperature: 0.4,
      }),
    });

    if (!res.ok) return claims.map(() => null);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return claims.map(() => null);

    const queries = JSON.parse(jsonMatch[0]) as Array<{ index: number; counterQuery: string }>;

    const checkedSet = new Set(toCheck.map((c) => c.claim));
    return claims.map((c) => {
      if (!checkedSet.has(c.claim)) return null;
      const idx = toCheck.findIndex((tc) => tc.claim === c.claim);
      const match = queries.find((q) => q.index === idx + 1);
      return match ? { claim: c.claim, counterQuery: match.counterQuery } : null;
    });
  } catch {
    return claims.map(() => null);
  }
}
