# llamaindex-browseaidev

LlamaIndex integration for [BrowseAI Dev](https://browseai.dev) — verified web search with citations and confidence scores for AI agents.

## Installation

```bash
pip install llamaindex-browseaidev
```

## Quick Start

```python
from llama_index.core.agent import ReActAgent
from llama_index.llms.openai import OpenAI
from llamaindex_browseaidev import BrowseAIDevAnswerTool, BrowseAIDevSearchTool

# Create tools
answer_tool = BrowseAIDevAnswerTool(api_key="bai_xxx")
search_tool = BrowseAIDevSearchTool(api_key="bai_xxx")

# Create agent
llm = OpenAI(model="gpt-4o")
agent = ReActAgent.from_tools([answer_tool, search_tool], llm=llm, verbose=True)

# Research with verified answers
response = agent.chat("What are the latest findings on mRNA vaccine efficacy?")
print(response)
```

## Available Tools

- **`BrowseAIDevAnswerTool`** — Verified research with citations, confidence scores, contradiction detection
- **`BrowseAIDevSearchTool`** — Web search returning ranked results
- **`BrowseAIDevExtractTool`** — Extract structured claims from a URL
- **`BrowseAIDevCompareTool`** — Compare raw LLM vs verified answer

All tools are returned as `FunctionTool` instances, compatible with any LlamaIndex agent.

## Why BrowseAI Dev?

Unlike raw search APIs, BrowseAI Dev fact-checks results. Every answer includes per-claim verification (BM25 + NLI), cross-source consensus, contradiction detection, and 7-factor evidence-based confidence scores. Open source (MIT).

## Links

- [Website](https://browseai.dev) · [GitHub](https://github.com/BrowseAI-HQ/BrowseAI-Dev) · [Discord](https://discord.gg/ubAuT4YQsT)
- [Python SDK](https://pypi.org/project/browseaidev/) · [LangChain](https://pypi.org/project/langchain-browseaidev/) · [CrewAI](https://pypi.org/project/crewai-browseaidev/) · [MCP Server](https://www.npmjs.com/package/browseai-dev)

## License

MIT
