/**
 * Clarity — Anti-Hallucination Prompt Engineering Service
 *
 * Takes a raw prompt, uses LLM to detect intent and hallucination risks,
 * then dynamically composes a clarity-enhanced version with the right
 * anti-hallucination techniques applied.
 */

import { LLM_ENDPOINT, LLM_MODEL } from "@browse/shared";
import type { ClarityIntent, ClarityTechnique, ClarityResult, BrowseResult } from "@browse/shared";
import { fetchWithRetry } from "../lib/retry.js";
import { answerQuery } from "./answer.js";
import type { Env } from "../config/env.js";
import type { CacheService } from "./cache.js";

// ── Technique Library (used by LLM to compose the final prompt) ──

const TECHNIQUE_FRAGMENTS: Record<ClarityTechnique, { label: string; instruction: string }> = {
  uncertainty_permission: {
    label: "Uncertainty Permission",
    instruction: `If you are unsure about any part of your answer, say "I don't have enough information to confidently assess this" rather than guessing. Partial answers with acknowledged gaps are better than complete answers with fabricated details.`,
  },
  direct_quote_grounding: {
    label: "Direct Quote Grounding",
    instruction: `Before answering, extract the exact word-for-word quotes from the provided context that are most relevant. Number each quote. Then base your answer ONLY on those extracted quotes, referencing them by number. If you cannot find relevant quotes, state "No relevant quotes found."`,
  },
  citation_then_verify: {
    label: "Citation-Then-Verify",
    instruction: `For every claim in your response, cite the specific source using [Source N] notation. After drafting, review EVERY claim — find a direct quote from the sources that supports it. If you cannot find a supporting quote for any claim, REMOVE that claim and mark the removal with [REMOVED — no supporting evidence].`,
  },
  chain_of_verification: {
    label: "Chain-of-Verification (CoVe)",
    instruction: `After drafting your response, (1) list 3-5 narrow verification questions for your key claims, (2) answer each verification question independently without looking at your draft, (3) compare and correct any inconsistencies. Remove any claims that fail verification.`,
  },
  step_back_abstraction: {
    label: "Step-Back Abstraction",
    instruction: `Before answering the specific question, first identify the general principles or concepts involved. Then apply those principles to the specific question. If the general principles suggest uncertainty, flag it explicitly.`,
  },
  source_attribution: {
    label: "Source Attribution",
    instruction: `Attribute every factual claim to a specific source. Only include information that would be found in the cited source. If a source would not cover the topic, say so explicitly.`,
  },
  external_knowledge_restriction: {
    label: "External Knowledge Restriction",
    instruction: `Answer using ONLY the information provided in the context. Do not use any prior knowledge or training data. If the answer is not in the context, say "Not found in provided context." Never extrapolate beyond what the context explicitly states.`,
  },
};

const ALL_TECHNIQUES = Object.keys(TECHNIQUE_FRAGMENTS) as ClarityTechnique[];

// ── LLM-Powered Intent Detection + Technique Selection ──

type AnalysisResult = {
  intent: ClarityIntent;
  techniques: ClarityTechnique[];
  risks: string[];
  userPromptRewrite: string;
};

async function analyzeForClarity(
  prompt: string,
  context: string | undefined,
  apiKey: string,
): Promise<AnalysisResult> {
  const techniqueList = ALL_TECHNIQUES.map(
    t => `- ${t}: ${TECHNIQUE_FRAGMENTS[t].label} — ${TECHNIQUE_FRAGMENTS[t].instruction.slice(0, 100)}...`
  ).join("\n");

  const res = await fetchWithRetry(LLM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are an anti-hallucination prompt engineer. Your job is to analyze a user's prompt, detect what kind of task it is, identify hallucination risks, select the right mitigation techniques, and rewrite the user prompt to be more grounded.

Available intent types:
- factual_question: Questions seeking specific facts, dates, numbers, definitions
- document_qa: Questions about specific documents/context provided
- content_generation: Writing articles, reports, summaries, emails
- agent_pipeline: System prompts, agent instructions, tool configurations
- code_generation: Writing, debugging, or explaining code
- general: Other tasks

Available anti-hallucination techniques:
${techniqueList}

Select 2-4 techniques most relevant to the detected intent and specific risks. Do NOT select all techniques — pick the ones that matter most for this specific prompt.

Rewrite the user prompt to naturally incorporate grounding cues without making it feel robotic. The rewrite should:
- Preserve the user's original intent completely
- Add specificity where vague ("tell me about X" → "What are the key facts about X, with dates and sources?")
- Add grounding cues natural to the question type
- NOT add technique names or meta-instructions to the user prompt — those go in the system prompt`,
        },
        {
          role: "user",
          content: `Analyze this prompt and return your analysis:\n\n${context ? `Context provided: Yes (${context.length} chars)\n\n` : ""}User prompt: "${prompt}"`,
        },
      ],
      tools: [
        {
          type: "function" as const,
          function: {
            name: "return_analysis",
            description: "Return the prompt analysis and clarity plan",
            parameters: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: ["factual_question", "document_qa", "content_generation", "agent_pipeline", "code_generation", "general"],
                  description: "Detected intent type",
                },
                techniques: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ALL_TECHNIQUES,
                  },
                  description: "Selected anti-hallucination techniques (2-4)",
                },
                risks: {
                  type: "array",
                  items: { type: "string" },
                  description: "Specific hallucination risks identified (e.g. 'may fabricate statistics', 'may invent source URLs')",
                },
                userPromptRewrite: {
                  type: "string",
                  description: "Rewritten user prompt with natural grounding cues. Must preserve original intent.",
                },
              },
              required: ["intent", "techniques", "risks", "userPromptRewrite"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_analysis" } },
    }),
  });

  const data = await res.json() as any;
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall) {
    // Fallback: return sensible defaults
    return {
      intent: "general",
      techniques: ["uncertainty_permission", "chain_of_verification"],
      risks: ["Unable to analyze — applying default safeguards"],
      userPromptRewrite: prompt,
    };
  }

  const parsed = JSON.parse(toolCall.function.arguments);

  // Validate techniques are real
  const validTechniques = (parsed.techniques as string[]).filter(
    t => ALL_TECHNIQUES.includes(t as ClarityTechnique)
  ) as ClarityTechnique[];

  return {
    intent: parsed.intent || "general",
    techniques: validTechniques.length > 0 ? validTechniques : ["uncertainty_permission"],
    risks: parsed.risks || [],
    userPromptRewrite: parsed.userPromptRewrite || prompt,
  };
}

// ── Main Function ──

export async function clarityPrompt(
  prompt: string,
  options: {
    context?: string;
    intent?: ClarityIntent;
    verify?: boolean;
    env: Env;
    cache: CacheService;
  },
): Promise<ClarityResult> {
  const apiKey = options.env.OPENROUTER_API_KEY;

  // Use LLM to analyze intent, detect risks, select techniques, and rewrite prompt
  const analysis = await analyzeForClarity(prompt, options.context, apiKey);

  const intent = options.intent || analysis.intent;
  const techniques = analysis.techniques;

  // Build system prompt from selected techniques
  const systemParts = [
    "You are a precise, evidence-based assistant that prioritizes accuracy over completeness.",
    "",
  ];

  // Add risk-specific warnings
  if (analysis.risks.length > 0) {
    systemParts.push("KNOWN RISKS FOR THIS QUERY:");
    for (const risk of analysis.risks) {
      systemParts.push(`- ${risk}`);
    }
    systemParts.push("");
  }

  // Add technique instructions
  systemParts.push("ANTI-HALLUCINATION RULES:");
  for (const t of techniques) {
    systemParts.push("");
    systemParts.push(`${TECHNIQUE_FRAGMENTS[t].label.toUpperCase()}:`);
    systemParts.push(TECHNIQUE_FRAGMENTS[t].instruction);
  }

  // Add context if provided
  if (options.context) {
    systemParts.push("");
    systemParts.push("CONTEXT:");
    systemParts.push(options.context);
  }

  const systemPrompt = systemParts.join("\n");

  // Use LLM-rewritten user prompt
  const userPrompt = analysis.userPromptRewrite;

  // Optional verification via browse_answer
  let verification: BrowseResult | undefined;
  if (options.verify) {
    try {
      verification = await answerQuery(prompt, options.env, options.cache, "fast");
    } catch {
      // Verification is best-effort — don't fail the clarity call
    }
  }

  return {
    original: prompt,
    intent,
    systemPrompt,
    userPrompt,
    techniques,
    verification,
  };
}
