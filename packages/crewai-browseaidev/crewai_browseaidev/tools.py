"""BrowseAI Dev tools for CrewAI agents."""

from __future__ import annotations

from typing import Any, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field


class _ClientMixin:
    """Shared client initialization."""

    api_key: str = ""
    base_url: str = "https://browseai.dev/api"
    _client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from browseaidev import BrowseAIDev

            self._client = BrowseAIDev(api_key=self.api_key, base_url=self.base_url)
        return self._client


# ── Search Tool ──────────────────────────────────────────────────────────────


class SearchInput(BaseModel):
    query: str = Field(description="The search query")
    limit: int = Field(default=5, description="Maximum number of results")


class BrowseAIDevSearchTool(_ClientMixin, BaseTool):
    """Search the web and return ranked results with URLs, titles, and snippets."""

    name: str = "browseaidev_search"
    description: str = "Search the web for information. Returns ranked results with URLs, titles, and snippets."
    args_schema: Type[BaseModel] = SearchInput

    def _run(self, query: str, limit: int = 5) -> str:
        client = self._get_client()
        results = client.search(query, limit=limit)
        lines = []
        for i, r in enumerate(results, 1):
            lines.append(f"{i}. [{r.title}]({r.url})")
            if r.snippet:
                lines.append(f"   {r.snippet}")
        return "\n".join(lines) if lines else "No results found."


# ── Answer Tool (Verified Search) ────────────────────────────────────────────


class AnswerInput(BaseModel):
    query: str = Field(description="The research question")
    depth: str = Field(default="fast", description="'fast', 'thorough', or 'deep'")


class BrowseAIDevAnswerTool(_ClientMixin, BaseTool):
    """Research a question with evidence-backed verification, citations, and confidence scores.

    Searches the web, verifies claims using BM25 + NLI semantic entailment,
    detects contradictions, and returns an answer with per-claim confidence.
    """

    name: str = "browseaidev_answer"
    description: str = (
        "Research a question with verified, evidence-backed answers. Returns citations, "
        "per-claim verification, confidence score (0-100%), and contradiction detection."
    )
    args_schema: Type[BaseModel] = AnswerInput

    def _run(self, query: str, depth: str = "fast") -> str:
        client = self._get_client()
        result = client.ask(query, depth=depth)

        parts = [f"**Answer:** {result.answer}", f"**Confidence:** {result.confidence:.0%}"]

        if result.claims:
            parts.append(f"\n**Verified Claims ({len(result.claims)}):**")
            for i, claim in enumerate(result.claims, 1):
                status = "verified" if claim.verified else "unverified"
                parts.append(f"  {i}. [{status}] {claim.claim}")

        if result.contradictions:
            parts.append(f"\n**Contradictions ({len(result.contradictions)}):**")
            for c in result.contradictions:
                parts.append(f"  - {c.claim_a} vs {c.claim_b}")

        if result.sources:
            parts.append(f"\n**Sources ({len(result.sources)}):**")
            for s in result.sources:
                parts.append(f"  - [{s.title}]({s.url})")

        return "\n".join(parts)


# ── Extract Tool ─────────────────────────────────────────────────────────────


class ExtractInput(BaseModel):
    url: str = Field(description="URL to extract from")
    query: str | None = Field(default=None, description="Optional focus query")


class BrowseAIDevExtractTool(_ClientMixin, BaseTool):
    """Extract structured claims and knowledge from a web page."""

    name: str = "browseaidev_extract"
    description: str = "Extract verified claims and knowledge from a URL."
    args_schema: Type[BaseModel] = ExtractInput

    def _run(self, url: str, query: str | None = None) -> str:
        client = self._get_client()
        result = client.extract(url, query=query)

        parts = [f"**Extracted from:** {url}"]
        if result.answer:
            parts.append(f"**Summary:** {result.answer}")
        parts.append(f"**Confidence:** {result.confidence:.0%}")

        if result.claims:
            parts.append(f"\n**Claims ({len(result.claims)}):**")
            for i, claim in enumerate(result.claims, 1):
                status = "verified" if claim.verified else "unverified"
                parts.append(f"  {i}. [{status}] {claim.claim}")

        return "\n".join(parts)


# ── Compare Tool ─────────────────────────────────────────────────────────────


class CompareInput(BaseModel):
    query: str = Field(description="Question to compare raw LLM vs verified answers")


class BrowseAIDevCompareTool(_ClientMixin, BaseTool):
    """Compare raw LLM answer against evidence-backed verified answer."""

    name: str = "browseaidev_compare"
    description: str = "Compare raw LLM vs verified answer to detect hallucinations."
    args_schema: Type[BaseModel] = CompareInput

    def _run(self, query: str) -> str:
        client = self._get_client()
        result = client.compare(query)

        parts = [
            "**Raw LLM Answer (unverified):**",
            result.raw_llm.answer,
            "",
            "**Evidence-Backed Answer (verified):**",
            result.evidence_backed.answer,
            f"**Confidence:** {result.evidence_backed.confidence:.0%}",
        ]

        return "\n".join(parts)


# ── Clarity Tool ────────────────────────────────────────────────────────────


class ClarityInput(BaseModel):
    prompt: str = Field(description="The raw prompt to rewrite with anti-hallucination techniques")
    context: str | None = Field(default=None, description="Optional context for the prompt")
    verify: bool = Field(default=False, description="Whether to verify the rewritten prompt with evidence")


class BrowseAIDevClarityTool(_ClientMixin, BaseTool):
    """Clarity — anti-hallucination prompt engineering. Rewrites any prompt with grounding techniques to reduce LLM hallucinations."""

    name: str = "browseaidev_clarity"
    description: str = (
        "Clarity — anti-hallucination prompt engineering. Rewrites any prompt with "
        "grounding techniques to reduce LLM hallucinations."
    )
    args_schema: Type[BaseModel] = ClarityInput

    def _run(self, prompt: str, context: str | None = None, verify: bool = False) -> str:
        client = self._get_client()
        result = client.clarity(prompt, context=context, verify=verify)

        parts = [
            f"**Intent:** {result.intent}",
            f"\n**System Prompt:**\n{result.system_prompt}",
            f"\n**User Prompt:**\n{result.user_prompt}",
            f"\n**Techniques ({len(result.techniques)}):**",
        ]
        for t in result.techniques:
            parts.append(f"  - {t}")

        return "\n".join(parts)
