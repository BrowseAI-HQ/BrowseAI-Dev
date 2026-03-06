import { LLM_ENDPOINT, LLM_MODEL } from "@browse/shared";
import type { BrowseResult } from "@browse/shared";

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
      "Return extracted knowledge with claims, sources, answer, and confidence",
    parameters: {
      type: "object",
      properties: {
        answer: {
          type: "string",
          description:
            "A clear, comprehensive answer to the question (2-4 paragraphs)",
        },
        confidence: {
          type: "number",
          description: "Confidence score between 0 and 1",
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
      required: ["answer", "confidence", "claims", "sources"],
      additionalProperties: false,
    },
  },
};

export async function extractKnowledge(
  query: string,
  pageContents: string,
  apiKey: string
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

  return {
    answer: knowledge.answer,
    claims: knowledge.claims || [],
    sources: knowledge.sources || [],
    confidence: knowledge.confidence || 0.85,
  };
}
