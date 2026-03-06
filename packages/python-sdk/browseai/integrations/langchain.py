"""LangChain tool integrations for BrowseAI Dev.

Usage::

    from browseai.integrations.langchain import BrowseAISearchTool, BrowseAIAskTool

    tools = [BrowseAISearchTool(api_key="bai_xxx"), BrowseAIAskTool(api_key="bai_xxx")]
    agent = initialize_agent(tools, llm)
"""

from __future__ import annotations

from typing import Any

from langchain_core.tools import BaseTool
from pydantic import Field

from ..client import BrowseAI


class BrowseAISearchTool(BaseTool):
    """Search the web via BrowseAI Dev. Returns ranked results with URLs and snippets."""

    name: str = "browseai_search"
    description: str = (
        "Search the web for information on a topic. Returns a list of relevant URLs, "
        "titles, snippets, and relevance scores. Use this for broad web searches."
    )
    client: Any = Field(exclude=True)

    def __init__(self, api_key: str | None = None, *, client: BrowseAI | None = None, **kwargs: Any):
        cli = client or BrowseAI(api_key=api_key)
        super().__init__(client=cli, **kwargs)

    def _run(self, query: str) -> str:
        results = self.client.search(query)
        lines = []
        for r in results:
            lines.append(f"- [{r.title}]({r.url}): {r.snippet}")
        return "\n".join(lines) if lines else "No results found."


class BrowseAIAskTool(BaseTool):
    """Full research pipeline via BrowseAI Dev. Returns answer with citations and confidence."""

    name: str = "browseai_ask"
    description: str = (
        "Research a question using BrowseAI Dev's evidence-backed pipeline. "
        "Searches the web, extracts claims from sources, and returns a cited answer "
        "with confidence score. Use this for questions requiring reliable, sourced answers."
    )
    client: Any = Field(exclude=True)

    def __init__(self, api_key: str | None = None, *, client: BrowseAI | None = None, **kwargs: Any):
        cli = client or BrowseAI(api_key=api_key)
        super().__init__(client=cli, **kwargs)

    def _run(self, query: str) -> str:
        result = self.client.ask(query)
        sources = "\n".join(f"  - [{s.title}]({s.url})" for s in result.sources)
        return (
            f"{result.answer}\n\n"
            f"Confidence: {result.confidence:.0%}\n"
            f"Sources:\n{sources}"
        )


class BrowseAIExtractTool(BaseTool):
    """Extract structured knowledge from a specific URL via BrowseAI Dev."""

    name: str = "browseai_extract"
    description: str = (
        "Extract structured knowledge (claims, sources, confidence) from a specific URL. "
        "Optionally provide a query to focus the extraction. "
        "Input format: 'url' or 'url | query'"
    )
    client: Any = Field(exclude=True)

    def __init__(self, api_key: str | None = None, *, client: BrowseAI | None = None, **kwargs: Any):
        cli = client or BrowseAI(api_key=api_key)
        super().__init__(client=cli, **kwargs)

    def _run(self, input_str: str) -> str:
        parts = input_str.split("|", 1)
        url = parts[0].strip()
        query = parts[1].strip() if len(parts) > 1 else None
        result = self.client.extract(url, query=query)
        sources = "\n".join(f"  - [{s.title}]({s.url})" for s in result.sources)
        return (
            f"{result.answer}\n\n"
            f"Confidence: {result.confidence:.0%}\n"
            f"Sources:\n{sources}"
        )
