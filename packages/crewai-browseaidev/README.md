# crewai-browseaidev

CrewAI integration for [BrowseAI Dev](https://browseai.dev) — verified web search with citations and confidence scores for AI agents.

## Installation

```bash
pip install crewai-browseaidev
```

## Quick Start

```python
from crewai import Agent, Task, Crew
from crewai_browseaidev import BrowseAIDevAnswerTool, BrowseAIDevSearchTool

# Create tools
answer_tool = BrowseAIDevAnswerTool(api_key="bai_xxx")
search_tool = BrowseAIDevSearchTool(api_key="bai_xxx")

# Create a research agent
researcher = Agent(
    role="Research Analyst",
    goal="Provide accurate, evidence-backed research",
    backstory="You are a meticulous researcher who verifies every claim.",
    tools=[answer_tool, search_tool],
)

# Create a task
task = Task(
    description="Research the current state of quantum computing",
    expected_output="A verified summary with citations and confidence scores",
    agent=researcher,
)

# Run
crew = Crew(agents=[researcher], tasks=[task])
result = crew.kickoff()
```

## Available Tools

- **`BrowseAIDevAnswerTool`** — Verified research with citations, confidence scores, contradiction detection
- **`BrowseAIDevSearchTool`** — Web search returning ranked results
- **`BrowseAIDevExtractTool`** — Extract structured claims from a URL
- **`BrowseAIDevCompareTool`** — Compare raw LLM vs verified answer

## Why BrowseAI Dev?

Unlike raw search APIs, BrowseAI Dev fact-checks results. Every answer includes per-claim verification (BM25 + NLI), cross-source consensus, contradiction detection, and 8-factor evidence-based confidence scores. Open source (MIT).

## Links

- [Website](https://browseai.dev) · [GitHub](https://github.com/BrowseAI-HQ/BrowseAI-Dev) · [Discord](https://discord.gg/ubAuT4YQsT)
- [Python SDK](https://pypi.org/project/browseaidev/) · [LangChain](https://pypi.org/project/langchain-browseaidev/) · [MCP Server](https://www.npmjs.com/package/browseai-dev)

## License

MIT
