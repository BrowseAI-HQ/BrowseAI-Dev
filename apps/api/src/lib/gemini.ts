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

/**
 * Compute confidence from real evidence signals instead of LLM self-assessment.
 *
 * 7-factor model (each contributes a weighted portion):
 *   1. Source count       (15%) — more sources = more corroboration
 *   2. Domain diversity   (10%) — claims backed by different domains are stronger
 *   3. Claim grounding    (10%) — % of claims that cite at least one source
 *   4. Citation depth     (5%)  — avg citations per claim
 *   5. Verification rate  (25%) — % of claims verified in actual source text
 *   6. Domain authority   (20%) — quality/trustworthiness of source domains
 *   7. Consensus score    (15%) — cross-source agreement across independent domains
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

  // Query-type-aware weights:
  // Factual queries: consensus and source count matter more than BM25 text matching.
  // For facts, "multiple sources agree" IS the verification — paraphrasing
  // shouldn't penalize confidence when the answer is clearly correct.
  // Opinion/comparison queries: verification rate stays high because claims
  // are more nuanced and need careful textual evidence.
  const isFactual = queryType === "factual";
  const weights = isFactual
    ? { source: 0.20, domain: 0.10, grounding: 0.10, depth: 0.05, verification: 0.10, authority: 0.20, consensus: 0.25 }
    : { source: 0.15, domain: 0.10, grounding: 0.10, depth: 0.05, verification: 0.25, authority: 0.20, consensus: 0.15 };

  let raw =
    sourceScore * weights.source +
    domainScore * weights.domain +
    groundingScore * weights.grounding +
    depthScore * weights.depth +
    verificationScoreVal * weights.verification +
    authorityScore * weights.authority +
    consensusVal * weights.consensus;

  // Contradiction penalty: each contradiction reduces confidence
  if (contradictionCount > 0) {
    raw = Math.max(0, raw - contradictionCount * 0.05);
  }

  // Factual query boost: settled facts with consensus and no contradictions
  // deserve higher confidence — low BM25 scores on paraphrased text shouldn't
  // penalize answers that multiple sources agree on.
  if (queryType === "factual" && contradictionCount === 0) {
    // Multiple sources grounded with some verification → high confidence floor
    if (sources.length >= 2 && groundingScore >= 0.5 && verificationRate >= 0.3) {
      raw = Math.max(raw, 0.80);
    }
    // Even with minimal verification, consensus across sources is strong signal
    if (consensusScore >= 0.5 && sources.length >= 3) {
      raw = Math.max(raw, 0.75);
    }
  }

  // Scale to 0.10–0.97 range and round to 2 decimals
  return Math.round((0.10 + raw * 0.87) * 100) / 100;
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

export async function extractKnowledge(
  query: string,
  pageContents: string,
  apiKey: string,
  pageTexts?: Map<string, string>,
  queryType?: QueryType,
): Promise<Omit<BrowseResult, "trace">> {
  const systemPrompt = getExtractionPrompt(queryType);
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
          content: `Question: ${query}\n\nWeb sources:\n${pageContents}`,
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
    if (res.status === 402) throw new Error("AI credits exhausted.");
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

  const claims: BrowseClaim[] = knowledge.claims || [];
  const sources: BrowseSource[] = knowledge.sources || [];

  // Run post-extraction verification if page texts are available
  if (pageTexts && pageTexts.size > 0) {
    const verification = verifyEvidence(claims, sources, pageTexts);
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
    confidence: computeConfidence(claims, sources),
  };
}
