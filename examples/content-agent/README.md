# Content Agent

An AI agent that writes blog posts where every stat, claim, and fact is backed by real sources with confidence scores.

## What it does

1. Takes a topic (e.g., "The state of AI in healthcare 2026")
2. Researches the topic using BrowseAI Dev's thorough mode
3. Extracts verified claims with citations
4. Writes a complete blog post where every factual statement links to its source
5. Flags contradictions found across sources

## Install

```bash
pip install -r requirements.txt
```

## Usage

```bash
# With API key
BROWSEAI_API_KEY=bai_xxx python agent.py "The state of AI in healthcare 2026"

# With BYOK
TAVILY_API_KEY=tvly_xxx OPENROUTER_API_KEY=sk-or-xxx python agent.py "topic"

# Interactive mode
python agent.py
```

## How it works

```
Topic → BrowseAI Dev (thorough) → Verified Claims + Citations → Blog Post
```

The agent uses BrowseAI Dev's evidence-backed research to ensure every claim in the output has a real source. Claims below the confidence threshold are marked as unverified. Contradictions between sources are surfaced inline.

## Features Used

- `ask()` with `depth="thorough"` — deep research with auto-retry
- Citations with confidence scores
- Contradiction detection
- Source domain authority
