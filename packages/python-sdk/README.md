# browseai

**Reliable research infrastructure for AI agents.** Python SDK for [BrowseAI Dev](https://browseai.dev) — the research layer for LangChain, CrewAI, and custom agent pipelines.

## Install

```bash
pip install browseai
```

## Quick Start

```python
from browseai import BrowseAI

client = BrowseAI(api_key="bai_xxx")

# Research with citations
result = client.ask("What is quantum computing?")
print(result.answer)
print(f"Confidence: {result.confidence:.0%}")
for source in result.sources:
    print(f"  - {source.title}: {source.url}")

# Thorough mode — auto-retries if confidence < 60%
deep = client.ask("What is quantum computing?", depth="thorough")

# Web search
results = client.search("latest AI news", limit=5)

# Page extraction
page = client.open("https://example.com")

# Structured extraction from a URL
extract = client.extract("https://example.com", query="pricing info")

# Compare raw LLM vs evidence-backed
compare = client.compare("Is Python faster than Rust?")

# Submit feedback to improve accuracy
client.feedback(result_id=result.share_id, rating="good")
```

## Async

```python
from browseai import AsyncBrowseAI

async with AsyncBrowseAI(api_key="bai_xxx") as client:
    result = await client.ask("What is quantum computing?")
    # Thorough mode works with async too
    deep = await client.ask("What is quantum computing?", depth="thorough")
```

## Streaming (REST API)

For real-time progress events, use the streaming endpoint directly:

```python
import httpx

with httpx.stream("POST", "https://browseai.dev/api/browse/answer/stream",
    json={"query": "What is quantum computing?"},
    headers={"X-Tavily-Key": "tvly-xxx", "X-OpenRouter-Key": "sk-or-xxx"}
) as response:
    for line in response.iter_lines():
        if line.startswith("data: "):
            print(line[6:])
```

Events: `trace` (progress), `sources` (discovered early), `result` (final answer), `done`.

## Research Memory (Sessions)

Persistent research sessions that accumulate knowledge across multiple queries. Later queries recall prior knowledge — faster, cheaper, more coherent.

> **Sessions require a BrowseAI Dev API key** (`api_key="bai_xxx"`) for identity and ownership. BYOK clients (`tavily_key`/`openrouter_key` only) can use search/answer but cannot create or access sessions. Get a free API key at [browseai.dev/dashboard](https://browseai.dev/dashboard).

```python
from browseai import BrowseAI

client = BrowseAI(api_key="bai_xxx")

# Create a session
session = client.session("wasm-research")

# Each query builds on previous knowledge
r1 = session.ask("What is WebAssembly?")
r2 = session.ask("How does WASM compare to JavaScript performance?")
# ^ r2 recalls WASM knowledge from r1, only searches for JS perf

# Query accumulated knowledge without new searches
recalled = session.recall("WASM")
for entry in recalled.entries:
    print(f"  {entry.claim} (from: {entry.origin_query})")

# Export all knowledge
knowledge = session.knowledge()

# Delete a session
session.delete()

# List all your sessions
sessions = client.list_sessions()

# Resume an existing session by ID
session = client.get_session("session-id-here")

# Share with other agents
share = session.share()
print(share.url)  # https://browseai.dev/session/share/abc123def456

# Another agent forks and continues the research
forked = client.fork_session(share.share_id)
```

Async sessions work the same way:

```python
async with AsyncBrowseAI(api_key="bai_xxx") as client:
    session = await client.session("my-project")
    r1 = await session.ask("What is WASM?")
    r2 = await session.ask("WASM vs JS?")

    # Share and fork work async too
    share = await session.share()
    forked = await client.fork_session(share.share_id)
```

## Premium Features (with API Key)

Users with a BrowseAI Dev API key (`bai_xxx`) get enhanced verification:
- **NLI semantic reranking** — evidence matched by meaning, not just keywords
- **Multi-provider search** — parallel search across multiple sources for broader coverage
- **Multi-pass consistency** — claims cross-checked across independent extraction passes (in thorough mode)
- **Research Sessions** — persistent memory across queries

Free BAI key users get a generous daily quota (50 premium queries/day). When exceeded, queries gracefully fall back to BM25 keyword verification — still works, just basic matching. Quota resets every 24 hours. Check `client.last_quota` after any API call for current usage.

BYOK users get BM25 keyword verification — fast and reliable, but without the premium pipeline.

## BYOK (Bring Your Own Keys)

```python
client = BrowseAI(tavily_key="tvly-xxx", openrouter_key="sk-or-xxx")
```

## LangChain

```bash
pip install browseai[langchain]
```

```python
from browseai.integrations.langchain import BrowseAIAskTool

tools = [BrowseAIAskTool(api_key="bai_xxx")]
```

## CrewAI

```bash
pip install browseai[crewai]
```

```python
from browseai.integrations.crewai import BrowseAITool

researcher = Agent(tools=[BrowseAITool(api_key="bai_xxx")])
```
