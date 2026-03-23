---
name: browse-research
description: Evidence-backed web research with citations and confidence scores. Use when the user needs researched, verified answers backed by real sources — not LLM hallucinations.
---

# BrowseAI Dev — Evidence-Backed Research

Use this skill when the user needs researched, cited answers backed by real web sources — not LLM hallucinations.

## When to Use

- User asks a factual question and wants verified, sourced answers
- User says "research this", "find out", "what does the evidence say", "look this up"
- User needs citations, confidence scores, or source verification
- User wants to know if something is true or needs fact-checking
- Any question where accuracy matters more than speed

## Prerequisites

Install BrowseAI Dev MCP server:

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

Or set `BROWSE_API_KEY=bai_xxx` for full features (sessions, sharing, knowledge export).

## Workflow

### Step 1: Research the Question

Use `browse_answer` to get a cited, evidence-backed answer:

```
browse_answer({ query: "How do mRNA vaccines work?", depth: "fast" })
```

Use `depth: "thorough"` when:
- The topic is nuanced or controversial
- You need high confidence (thorough auto-retries with rephrased queries if confidence < 60%)
- The user explicitly asks for deep research

### Step 2: Interpret the Response

The response contains:

- **answer**: The synthesized answer from real sources
- **claims[]**: Individual claims, each with source URLs, verification status, consensus level
- **sources[]**: Each source with URL, title, domain, quote, authority score
- **confidence**: 0-1 score computed from 7 real factors (NOT LLM self-assessed)
- **contradictions[]**: Conflicting claims found across sources
- **trace[]**: Pipeline timing (search, fetch, extract, verify, answer)

### Step 3: Present to the User

When presenting results:

1. Lead with the answer
2. Cite sources inline using the URLs from `claims[].sources`
3. Mention confidence: "Confidence: 78% based on 5 sources"
4. If contradictions exist, surface them: "Note: sources disagree on X"
5. If confidence < 50%, caveat: "Limited evidence available — treat with caution"

### Confidence Score Guide

| Range | Meaning |
|-------|---------|
| 80-100% | Strong evidence, multiple corroborating sources |
| 60-79% | Good evidence, some gaps |
| 40-59% | Mixed evidence, contradictions possible |
| 0-39% | Weak evidence, few or low-quality sources |

### Example

User: "Is intermittent fasting effective for weight loss?"

```
browse_answer({
  query: "Is intermittent fasting effective for weight loss? What does the research say?",
  depth: "thorough"
})
```

Present the answer with inline citations, highlight any contradictions between studies, and note the confidence score.

## Clarity: Anti-Hallucination Prompt Engineering

Before generating content or answering questions, use `browse_clarity` to automatically apply anti-hallucination techniques to your prompt:

```
browse_clarity({ prompt: "Your question or instruction here", verify: true })
```

This returns a Clarity system prompt + rewritten user prompt with anti-hallucination grounding cues. Use these with any LLM to get more factual outputs. Combine with `browse_answer` for full verification.

## Tips

- Frame queries as specific questions, not keywords ("What causes aurora borealis?" not "aurora borealis")
- Include temporal context for time-sensitive topics ("latest AI regulations 2025")
- For controversial topics, expect contradictions — surface them rather than hiding them
- Use `browse_search` first if you just need URLs, not a full researched answer
- Use `browse_harden` before generating content to reduce hallucinations in the output

## Links

- [BrowseAI Dev](https://browseai.dev)
- [Documentation](https://browseai.dev/docs)
- [MCP Server](https://www.npmjs.com/package/browseai-dev)
- [GitHub](https://github.com/BrowseAI-HQ/BrowseAI-Dev)
