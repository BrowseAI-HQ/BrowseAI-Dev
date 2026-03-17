# langchain-browseaidev

LangChain integration for [BrowseAI Dev](https://browseai.dev) — verified web search with citations and confidence scores for AI agents.

**Unlike raw search APIs, BrowseAI Dev fact-checks results before returning them.** Every answer includes per-claim verification, cross-source consensus, contradiction detection, and evidence-based confidence scores.

## Installation

```bash
pip install langchain-browseaidev
```

## Quick Start

```python
from langchain_browseaidev import BrowseAIDevAnswerTool

# Verified search with citations and confidence
tool = BrowseAIDevAnswerTool(api_key="bai_xxx")
result = tool.invoke({"query": "What is quantum computing?"})
print(result)
```

## Available Tools

### `BrowseAIDevAnswerTool` — Verified Research (recommended)

The primary tool. Searches the web, extracts claims, verifies them using BM25 + NLI semantic entailment, detects contradictions, and returns an answer with confidence scores.

```python
from langchain_browseaidev import BrowseAIDevAnswerTool

tool = BrowseAIDevAnswerTool(api_key="bai_xxx")

# Fast mode (default)
result = tool.invoke({"query": "Is nuclear energy safe?"})

# Thorough mode (retries if confidence < 60%)
result = tool.invoke({"query": "Health effects of intermittent fasting", "depth": "thorough"})

# Deep mode (multi-step agentic research with gap analysis)
result = tool.invoke({"query": "Compare CRISPR vs base editing approaches", "depth": "deep"})
```

### `BrowseAIDevSearchTool` — Web Search

Basic web search returning ranked results with URLs, titles, and snippets.

```python
from langchain_browseaidev import BrowseAIDevSearchTool

tool = BrowseAIDevSearchTool(api_key="bai_xxx")
result = tool.invoke({"query": "AI safety regulations 2024", "limit": 5})
```

### `BrowseAIDevExtractTool` — Page Extraction

Extract structured claims and knowledge from a specific URL.

```python
from langchain_browseaidev import BrowseAIDevExtractTool

tool = BrowseAIDevExtractTool(api_key="bai_xxx")
result = tool.invoke({"url": "https://arxiv.org/abs/2303.08774", "query": "What are GPT-4's capabilities?"})
```

### `BrowseAIDevCompareTool` — Raw vs Verified

Compare a raw LLM answer against an evidence-backed verified answer. Shows where LLMs hallucinate.

```python
from langchain_browseaidev import BrowseAIDevCompareTool

tool = BrowseAIDevCompareTool(api_key="bai_xxx")
result = tool.invoke({"query": "Is remote work more productive?"})
```

## Use with LangChain Agents

```python
from langchain_browseaidev import BrowseAIDevAnswerTool, BrowseAIDevSearchTool
from langchain_openai import ChatOpenAI
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(model="gpt-4o")
tools = [
    BrowseAIDevAnswerTool(api_key="bai_xxx"),
    BrowseAIDevSearchTool(api_key="bai_xxx"),
]

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a research assistant. Use browseaidev_answer for fact-checked answers with citations."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools)

result = executor.invoke({"input": "What are the latest findings on mRNA vaccine efficacy?"})
print(result["output"])
```

## Why BrowseAI Dev over Tavily/Exa?

| Feature | BrowseAI Dev | Tavily | Exa |
|---|---|---|---|
| Claim verification (BM25+NLI) | Yes | No | No |
| Evidence-based confidence scores | 7-factor | No | No |
| Cross-source consensus | Yes | No | No |
| Contradiction detection | Yes | No | No |
| Deep research mode | Yes | No | Yes |
| Open source (MIT) | Yes | No | No |
| Free tier | 100 verified/day | 1K search/mo | Limited |

## Get an API Key

1. Go to [browseai.dev](https://browseai.dev)
2. Sign in with GitHub
3. Your `bai_xxx` key is on the dashboard

Or bring your own keys (Tavily + OpenRouter) for unlimited usage.

## Links

- [Website](https://browseai.dev)
- [Documentation](https://browseai.dev/docs)
- [GitHub](https://github.com/BrowseAI-HQ/BrowseAI-Dev)
- [Discord](https://discord.gg/ubAuT4YQsT)
- [Python SDK](https://pypi.org/project/browseaidev/)
- [MCP Server](https://www.npmjs.com/package/browseai-dev)

## License

MIT
