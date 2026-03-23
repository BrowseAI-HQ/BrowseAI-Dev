# browseaidev

**Reliable research infrastructure for AI agents.** Python SDK for [BrowseAI Dev](https://browseai.dev) — the research layer for LangChain, CrewAI, and custom agent pipelines.

## Install

```bash
pip install browseaidev
```

## Quick Start

```python
from browseaidev import BrowseAIDev

client = BrowseAIDev(api_key="bai_xxx")

# Research with citations
result = client.ask("What is quantum computing?")
print(result.answer)
print(f"Confidence: {result.confidence:.0%}")
for source in result.sources:
    print(f"  - {source.title}: {source.url}")

# Thorough mode — auto-retries if confidence < 60%
thorough = client.ask("What is quantum computing?", depth="thorough")

# Deep mode — multi-step agentic research with iterative gap analysis (requires BAI key + sign-in)
# Runs think→search→extract→evaluate cycles (up to 4 steps), 3x quota cost
deep = client.ask("Compare CRISPR approaches", depth="deep")
for step in deep.reasoning_steps or []:
    print(f"  Step {step.step}: {step.query} ({step.confidence:.0%})")

# Web search
results = client.search("latest AI news", limit=5)

# Page extraction
page = client.open("https://example.com")

# Structured extraction from a URL
extract = client.extract("https://example.com", query="pricing info")

# Compare raw LLM vs evidence-backed
compare = client.compare("Is Python faster than Rust?")

# Clarity — anti-hallucination prompt engineering
clarity = client.clarity("Write a blog post about quantum computing")
print(clarity.system_prompt)  # Clarity system prompt with anti-hallucination rules
print(clarity.user_prompt)    # Rewritten prompt with grounding cues

# Submit feedback to improve accuracy
client.feedback(result_id=result.share_id, rating="good")
```

## Async

```python
from browseaidev import AsyncBrowseAIDev

async with AsyncBrowseAIDev(api_key="bai_xxx") as client:
    result = await client.ask("What is quantum computing?")
    # Thorough mode works with async too
    thorough = await client.ask("What is quantum computing?", depth="thorough")
    # Deep mode — multi-step agentic research (requires BAI key + sign-in, 3x quota cost)
    deep = await client.ask("Complex research question", depth="deep")
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

Events: `trace` (progress), `sources` (discovered early), `token` (streamed answer text), `result` (final answer), `done`.

## Research Memory (Sessions)

Persistent research sessions that accumulate knowledge across multiple queries. Later queries recall prior knowledge — faster, cheaper, more coherent.

> **Sessions require a BrowseAI Dev API key** (`api_key="bai_xxx"`) for identity and ownership. BYOK clients (`tavily_key`/`openrouter_key` only) can use search/answer but cannot create or access sessions. Get a free API key at [browseai.dev/dashboard](https://browseai.dev/dashboard).

```python
from browseaidev import BrowseAIDev

client = BrowseAIDev(api_key="bai_xxx")

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
async with AsyncBrowseAIDev(api_key="bai_xxx") as client:
    session = await client.session("my-project")
    r1 = await session.ask("What is WASM?")
    r2 = await session.ask("WASM vs JS?")

    # Share and fork work async too
    share = await session.share()
    forked = await client.fork_session(share.share_id)
```

## Premium Features (with API Key)

Users with a BrowseAI Dev API key (`bai_xxx`) get enhanced verification:
- **Neural cross-encoder re-ranking** — search results re-scored by semantic query-document relevance
- **NLI semantic reranking** — evidence matched by meaning, not just keywords
- **Multi-provider search** — parallel search across multiple sources for broader coverage
- **Multi-pass consistency** — claims cross-checked across independent extraction passes (in thorough mode)
- **Deep reasoning mode** — premium multi-step agentic research with iterative think-search-extract-evaluate cycles, gap analysis, and cross-step claim merging (up to 4 steps, targets 0.85 confidence, 3x quota cost, 100 deep queries/day). Falls back to thorough when quota is exhausted
- **Token streaming** — per-token answer delivery via SSE for real-time UI
- **Research Sessions** — persistent memory across queries

Free BAI key users get a generous daily quota (100 premium queries/day, or ~33 deep queries/day at 3x cost each). When exceeded, queries gracefully fall back to BM25 keyword verification (deep falls back to thorough) — still works, just basic matching. Quota resets every 24 hours. Check `client.last_quota` after any API call for current usage.

**No account needed** — BYOK works out of the box with no signup, no limits, and BM25 keyword verification. Sign in at [browseai.dev](https://browseai.dev) for a free BAI key to unlock premium features.

## Contradictions

Detect conflicts across sources on controversial topics:

```python
result = client.ask("Is coffee good for your health?", depth="thorough")
if result.contradictions:
    for c in result.contradictions:
        print(f"Conflict on '{c.topic}':")
        print(f"  A: {c.claim_a}")
        print(f"  B: {c.claim_b}")
```

## Enterprise Search Providers

Use your own data sources instead of — or alongside — public web search. Supports `elasticsearch`, `confluence`, and `custom` endpoints with optional `data_retention="none"` for compliance.

```python
from browseaidev.models import SearchProviderConfig

# Using the typed model (snake_case fields)
provider = SearchProviderConfig(
    type="elasticsearch",
    endpoint="https://es.company.com/kb/_search",
    auth_header="Bearer token",
    index="docs",
)
result = client.ask("What is our refund policy?", search_provider=provider)

# Or pass a plain dict (camelCase keys, sent directly to API)
result = client.ask("What is our refund policy?", search_provider={
    "type": "elasticsearch",
    "endpoint": "https://es.company.com/kb/_search",
    "authHeader": "Bearer token",
    "index": "docs",
})

# Confluence
result = client.ask("PCI compliance?", search_provider={
    "type": "confluence",
    "endpoint": "https://company.atlassian.net/wiki/rest/api",
    "authHeader": "Basic base64-creds",
    "spaceKey": "ENG",
})

# Zero data retention (compliance mode — nothing stored, cached, or logged)
result = client.ask("Patient protocols", search_provider=SearchProviderConfig(
    type="elasticsearch",
    endpoint="https://es.hipaa.company.com/medical/_search",
    auth_header="Bearer token",
    data_retention="none",
))
```

## BYOK (Bring Your Own Keys)

No signup required — just pass your own keys:

```python
client = BrowseAIDev(tavily_key="tvly-xxx", openrouter_key="sk-or-xxx")
```

## Framework Integrations

### LangChain

```bash
pip install langchain-browseaidev
```

```python
from langchain_browseaidev import BrowseAIDevAnswerTool, BrowseAIDevSearchTool

tools = [BrowseAIDevAnswerTool(api_key="bai_xxx")]
```

### CrewAI

```bash
pip install crewai-browseaidev
```

```python
from crewai_browseaidev import BrowseAIDevAnswerTool

researcher = Agent(tools=[BrowseAIDevAnswerTool(api_key="bai_xxx")])
```

### LlamaIndex

```bash
pip install llamaindex-browseaidev
```

```python
from llamaindex_browseaidev import BrowseAIDevAnswerTool

answer_tool = BrowseAIDevAnswerTool(api_key="bai_xxx")
```
