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
