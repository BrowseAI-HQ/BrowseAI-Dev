import { LLM_ENDPOINT, LLM_MODEL } from "@browse/shared";
import type { BrowseResult, BrowseClaim, BrowseSource } from "@browse/shared";
import { verifyEvidence } from "./verify.js";

const SYSTEM_PROMPT = `You are a knowledge extraction engine. Given web page content, extract structured claims with source attribution and write a clear answer.

Rules:
- Use only extracted evidence from the provided sources
- Never invent or fabricate sources
- Preserve citations by linking claims to source URLs
- Explain clearly in 2-4 paragraphs

Return a JSON object using the tool provided.`;

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

  // Weighted combination
  let raw =
    sourceScore * 0.15 +
    domainScore * 0.10 +
    groundingScore * 0.10 +
    depthScore * 0.05 +
    verificationScoreVal * 0.25 +
    authorityScore * 0.20 +
    consensusVal * 0.15;

  // Contradiction penalty: each contradiction reduces confidence
  if (contradictionCount > 0) {
    raw = Math.max(0, raw - contradictionCount * 0.05);
  }

  // Scale to 0.10–0.97 range and round to 2 decimals
  return Math.round((0.10 + raw * 0.87) * 100) / 100;
}

export async function extractKnowledge(
  query: string,
  pageContents: string,
  apiKey: string,
  pageTexts?: Map<string, string>,
): Promise<Omit<BrowseResult, "trace">> {
  const res = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
