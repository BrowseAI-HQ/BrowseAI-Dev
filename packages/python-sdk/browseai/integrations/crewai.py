"""CrewAI tool integration for BrowseAI Dev.

Usage::

    from browseai.integrations.crewai import BrowseAITool

    researcher = Agent(
        role="Researcher",
        tools=[BrowseAITool(api_key="bai_xxx")],
    )
"""

from __future__ import annotations

from typing import Any

from crewai.tools import BaseTool
from pydantic import Field

from ..client import BrowseAI


class BrowseAITool(BaseTool):
    """Research any question with evidence-backed answers via BrowseAI Dev."""

    name: str = "BrowseAI Research"
    description: str = (
        "Research a question using BrowseAI Dev. Searches the web, extracts claims, "
        "and returns a cited answer with confidence score and sources. "
        "Input should be a research question or topic."
    )
    client: Any = Field(exclude=True)

    def __init__(self, api_key: str | None = None, *, client: BrowseAI | None = None, **kwargs: Any):
        cli = client or BrowseAI(api_key=api_key)
        super().__init__(client=cli, **kwargs)

    def _run(self, query: str) -> str:
        result = self.client.ask(query)
        sources = "\n".join(f"  - [{s.title}]({s.url})" for s in result.sources)
        claims = "\n".join(f"  - {c.claim}" for c in result.claims)
        return (
            f"{result.answer}\n\n"
            f"Confidence: {result.confidence:.0%}\n"
            f"Claims:\n{claims}\n"
            f"Sources:\n{sources}"
        )
