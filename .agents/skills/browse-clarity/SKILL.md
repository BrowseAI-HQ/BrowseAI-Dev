---
name: browse-clarity
description: Reduce LLM hallucinations through evidence-backed prompt engineering. Use when crafting prompts, system instructions, or AI pipelines that need factual accuracy — not just vibes.
---

# BrowseAI Dev — Anti-Hallucination Prompt Engineering

Use this skill when you need to write prompts, system instructions, or AI agent pipelines that minimize hallucinations. Combines proven prompt engineering techniques with BrowseAI Dev's verification infrastructure for ground-truth anchoring.

## When to Use

- User is building an AI agent or pipeline and wants accurate, grounded outputs
- User says "make this more accurate", "reduce hallucinations", "stop making things up"
- User is writing system prompts, tool descriptions, or agent instructions
- User wants to fact-check or verify LLM-generated content before publishing
- User is designing a RAG pipeline and wants to minimize confabulation
- Any task where factual accuracy is more important than creativity

## Prerequisites

Install BrowseAI Dev MCP server for evidence-backed verification:

```json
{
  "mcpServers": {
    "browseai-dev": {
      "command": "npx",
      "args": ["-y", "browseai-dev"]
    }
  }
}
```

## The 7 Anti-Hallucination Techniques

### Technique 1: Explicit Uncertainty Permission

**What:** Give the LLM explicit permission to say "I don't know" instead of guessing.

**Why it works:** LLMs default to generating plausible-sounding text even when uncertain. Explicitly permitting abstention reduces confident-but-wrong outputs.

**Prompt pattern:**
```
Answer the following question using only information you are confident about.
If you are unsure about any part, say "I don't have enough information to
confidently assess this" rather than guessing. Partial answers with acknowledged
gaps are better than complete answers with fabricated details.

Question: {{QUESTION}}
```

**When to apply:** Always. This should be in every system prompt where accuracy matters.

### Technique 2: Direct Quote Grounding

**What:** Force the LLM to extract exact quotes from source material before reasoning about it.

**Why it works:** When an LLM extracts word-for-word quotes first, its subsequent reasoning is anchored to real text rather than reconstructed memories. Especially effective for documents >20K tokens.

**Prompt pattern:**
```
Given this document:
<document>
{{DOCUMENT}}
</document>

Step 1: Extract the exact quotes (word-for-word) from the document that are
most relevant to answering the question. Number each quote.
If you cannot find relevant quotes, state "No relevant quotes found."

Step 2: Using ONLY the extracted quotes, answer the question. Reference quotes
by number. Do not introduce any information not present in the quotes.

Question: {{QUESTION}}
```

**When to apply:** Any task involving long documents, reports, policies, or source material.

### Technique 3: Citation-Then-Verify Loop

**What:** Have the LLM generate a response with inline citations, then verify each claim against its citations. Remove any unsupported claims.

**Why it works:** Self-verification catches claims the LLM invented. Forcing retraction of unsupported claims is more effective than asking the model to "be accurate."

**Prompt pattern:**
```
Using only the provided sources, answer the question below.

<sources>
{{SOURCES}}
</sources>

Instructions:
1. Draft your answer, citing specific sources for each claim using [Source N] notation.
2. After drafting, review EVERY claim. For each claim, find a direct quote
   from the sources that supports it.
3. If you cannot find a supporting quote for any claim, REMOVE that claim
   and mark the removal with [REMOVED — no supporting evidence].
4. Present only the verified version.

Question: {{QUESTION}}
```

**When to apply:** Press releases, reports, summaries, any published content.

### Technique 4: Chain-of-Verification (CoVe)

**What:** A four-step self-critique loop: draft → generate verification questions → answer those questions independently → produce verified response.

**Why it works:** LLMs can answer narrow verification questions more reliably than they can produce a long, perfectly factual narrative in one shot. CoVe has been shown to improve accuracy by up to 23% (Dhuliawala et al., 2023).

**Prompt pattern:**
```
Step 1 — Draft: Answer this question.
"{{QUESTION}}"

Step 2 — Plan verification: List 3-5 specific, narrow factual questions that
would verify the key claims in your draft. Focus on dates, numbers, names,
and causal claims.

Step 3 — Verify independently: Answer each verification question from scratch,
WITHOUT looking at your draft. Use only what you know with high confidence.

Step 4 — Final answer: Compare your draft against your verification answers.
Correct any inconsistencies. Remove any claims that failed verification.
Present your final, verified answer.
```

**Critical:** Step 3 must be independent — if the model sees its draft while verifying, it copies the same hallucinations. In multi-turn implementations, use separate context windows.

**When to apply:** Complex factual questions, list-based answers, biographical or historical content.

### Technique 5: Step-Back Abstraction

**What:** Before answering a specific question, first ask the LLM to reason about the general principles or concepts involved, then apply those to the specific case.

**Why it works:** Abstract reasoning activates more reliable knowledge pathways than direct recall of specific facts. Outperforms chain-of-thought by up to 36% in some benchmarks (Zheng et al., 2023).

**Prompt pattern:**
```
Before answering the specific question, first answer this higher-level question:
"What are the general principles/factors that govern {{DOMAIN_OF_QUESTION}}?"

Now, apply those principles to answer the specific question:
"{{SPECIFIC_QUESTION}}"

If the general principles suggest you should be uncertain about any aspect
of the specific answer, flag that uncertainty explicitly.
```

**When to apply:** Technical questions, domain-specific queries, "how does X work?" questions.

### Technique 6: Source Attribution Prompting ("According to...")

**What:** Anchor the LLM's response to a specific source by including "according to [source]" in the prompt.

**Why it works:** Constraining the LLM to a specific source activates more targeted retrieval from its training data and discourages blending information across sources. Improves accuracy by up to 20% (Pan et al., 2023).

**Prompt pattern:**
```
According to {{SPECIFIC_SOURCE}}, {{QUESTION}}

Only include information that would be found in {{SPECIFIC_SOURCE}}.
If the source would not cover this topic, say so.
```

**When to apply:** When you need information from a specific source (Wikipedia, a specific paper, official documentation).

### Technique 7: External Knowledge Restriction

**What:** Explicitly instruct the LLM to use ONLY provided context, not its training data.

**Why it works:** Most hallucinations come from the LLM blending its (potentially outdated or incorrect) training data with provided context. A hard boundary prevents this.

**Prompt pattern:**
```
You are a research assistant. Answer questions using ONLY the information
provided in the context below. Do not use any prior knowledge or training data.

<context>
{{CONTEXT}}
</context>

Rules:
- If the answer is not in the context, say "Not found in provided context."
- Never extrapolate beyond what the context explicitly states.
- Quote the relevant section when answering.

Question: {{QUESTION}}
```

**When to apply:** RAG pipelines, document Q&A, any system where you control the context window.

## Verification with BrowseAI Dev

After applying prompt techniques, verify outputs against real-world evidence using BrowseAI Dev.

### Pattern A: Pre-Generation Grounding

Before the LLM generates content, search for evidence to include in context:

```
browse_search({ query: "{{TOPIC}}" })
```

Feed the search results into your prompt as the `<context>` or `<sources>` block. This turns any LLM into a grounded generator.

### Pattern B: Post-Generation Verification

After the LLM generates a response, verify each key claim:

```
browse_answer({
  query: "Is it true that {{CLAIM}}? What does the evidence say?",
  depth: "thorough"
})
```

Check `claims[].verified` and `claims[].verificationScore` for each result. Flag any claim with `verificationScore < 0.5` or `verified: false`.

### Pattern C: Side-by-Side Hallucination Detection

Compare what a raw LLM says vs what evidence shows:

```
browse_compare({ query: "{{QUESTION}}" })
```

The response shows `raw_llm` (ungrounded) vs `evidence_backed` (sourced). Differences reveal where hallucinations occur.

### Pattern D: Confidence-Gated Publishing

Only publish content that meets a confidence threshold:

```
result = browse_answer({ query: "{{CLAIM}}", depth: "thorough" })

if result.confidence >= 0.7:
    publish(result.answer)
elif result.confidence >= 0.4:
    publish(result.answer + "\n⚠️ Moderate confidence — verify independently")
else:
    flag_for_human_review(result)
```

## Combining Techniques: The Anti-Hallucination Stack

For maximum accuracy, layer techniques together:

### System Prompt Template

```
You are a research assistant that prioritizes accuracy over completeness.

RULES:
1. ONLY use information from the provided sources. Do not use training data.
2. For every claim, cite the specific source using [Source N] notation.
3. If you cannot find a source for a claim, do not include it.
4. If you are unsure, say "I'm not confident about this" — never guess.
5. After drafting, verify each claim against its cited source. Remove any
   claim where the source does not explicitly support it.

SOURCES:
<sources>
{{SOURCES_FROM_BROWSEAI_SEARCH}}
</sources>

Answer the user's question following ALL rules above.
```

### Full Pipeline (Agent Workflow)

```
1. User asks question
2. browse_search() → get real sources
3. LLM generates answer using sources + anti-hallucination system prompt
4. browse_answer(depth: "thorough") → verify key claims
5. Remove/flag any claim with confidence < 0.5
6. Present verified answer with citations and confidence score
```

## Automated Clarity: `browse_clarity` Tool

Instead of manually applying techniques, use the `browse_clarity` MCP tool to automatically apply anti-hallucination prompt engineering:

```
browse_clarity({
  prompt: "What are the side effects of metformin?",
  verify: true
})
```

The tool uses an LLM to:
1. **Detect intent** — factual question, document QA, content generation, agent pipeline, etc.
2. **Identify hallucination risks** — "may fabricate statistics", "may invent source URLs", etc.
3. **Select techniques** — picks 2-4 most relevant from the 7 techniques above
4. **Rewrite the prompt** — adds natural grounding cues without making it robotic
5. **Return Clarity system + user prompts** — ready to use with any LLM

Response includes:
- `systemPrompt`: Clarity system prompt with anti-hallucination technique instructions
- `userPrompt`: Rewritten user prompt with grounding cues
- `intent`: Auto-detected intent type
- `techniques`: Which techniques were applied
- `verification`: Optional evidence-backed verification (when `verify: true`)

### With Context (Document QA)

```
browse_clarity({
  prompt: "What does the report say about Q4 revenue?",
  context: "... full document text ...",
  verify: false
})
```

### For Agent Pipelines

```
browse_clarity({
  prompt: "You are a medical research assistant. Answer questions about drug interactions.",
  intent: "agent_pipeline"
})
```

### API Endpoint

```bash
curl -X POST https://browseai.dev/api/browse/clarity \
  -H "X-API-Key: bai_xxx" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What caused the 2008 financial crisis?", "verify": true}'
```

### Python SDK

```python
from browseaidev import BrowseAI

client = BrowseAI(api_key="bai_xxx")
result = client.clarity("What caused the 2008 financial crisis?", verify=True)
print(result.system_prompt)  # Clarity system prompt with anti-hallucination rules
print(result.user_prompt)    # Rewritten user prompt
print(result.techniques)     # ['uncertainty_permission', 'chain_of_verification', 'source_attribution']
```

## Common Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | Instead Do |
|---|---|---|
| "Be accurate" | Too vague — LLM already thinks it's accurate | Use specific techniques above |
| "Don't hallucinate" | LLMs don't know when they're hallucinating | Give permission to say "I don't know" |
| High temperature (>0.7) for factual tasks | Increases randomness = more hallucinations | Use temperature 0.0-0.3 for factual work |
| Asking for lists without constraints | LLMs pad lists with invented items | Specify "only include items you can cite" |
| Trusting confidence without verification | LLM self-assessed confidence is unreliable | Use BrowseAI Dev's evidence-based confidence |
| Single-pass generation | No self-correction opportunity | Use CoVe or citation-then-verify loop |

## Quick Reference: Which Technique When?

| Scenario | Best Technique(s) |
|---|---|
| Document Q&A | Direct Quote Grounding + External Knowledge Restriction |
| Factual questions | CoVe + BrowseAI Dev verification |
| Content generation | Citation-Then-Verify + Post-Generation Verification |
| System prompt design | Uncertainty Permission + External Knowledge Restriction |
| Agent pipeline | Full Anti-Hallucination Stack (all techniques combined) |
| Specific source queries | Source Attribution ("According to...") |
| Complex technical topics | Step-Back Abstraction + Thorough verification |

## References

- Dhuliawala et al. (2023) — Chain-of-Verification Reduces Hallucination in Large Language Models (Meta AI)
- Zheng et al. (2023) — Take a Step Back: Evoking Reasoning via Abstraction in Large Language Models (Google DeepMind)
- Pan et al. (2023) — "According to..." Prompting Reduces Hallucination in LLMs
- Anthropic — Reduce Hallucinations (Claude Docs)
- DAIR.AI — Prompt Engineering Guide

## Links

- [BrowseAI Dev](https://browseai.dev)
- [Documentation](https://browseai.dev/docs)
- [MCP Server](https://www.npmjs.com/package/browseai-dev)
- [GitHub](https://github.com/BrowseAI-HQ/BrowseAI-Dev)
