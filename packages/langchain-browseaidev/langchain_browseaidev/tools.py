"""BrowseAI Dev tools for LangChain agents."""

from __future__ import annotations

from typing import Any, Optional, Type

from langchain_core.callbacks import CallbackManagerForToolRun
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field


class _BrowseAIDevBase(BaseTool):
    """Base class for BrowseAI Dev tools."""

    api_key: str = Field(default="", description="BrowseAI Dev API key (bai_xxx)")
    base_url: str = Field(default="https://browseai.dev/api", description="API base URL")

    _client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from browseaidev import BrowseAIDev

            self._client = BrowseAIDev(api_key=self.api_key, base_url=self.base_url)
        return self._client


# ── Search Tool ──────────────────────────────────────────────────────────────


class SearchInput(BaseModel):
    query: str = Field(description="The search query")
    limit: int = Field(default=5, description="Maximum number of results to return")


class BrowseAIDevSearchTool(_BrowseAIDevBase):
    """Search the web and return ranked results with URLs, titles, and snippets.

    Use this when you need to find web pages about a topic but don't need
    verified answers. For fact-checked answers with confidence scores,
    use BrowseAIDevAnswerTool instead.
    """

    name: str = "browseaidev_search"
    description: str = (
        "Search the web for information. Returns ranked results with URLs, "
        "titles, and snippets. Use this for broad web search."
    )
    args_schema: Type[BaseModel] = SearchInput

    def _run(
        self,
        query: str,
        limit: int = 5,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
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
    query: str = Field(description="The research question to answer with verified evidence")
    depth: str = Field(
        default="fast",
        description="Search depth: 'fast' (default), 'thorough' (retries if low confidence), or 'deep' (multi-step agentic research)",
    )


class BrowseAIDevAnswerTool(_BrowseAIDevBase):
    """Research a question with evidence-backed verification, citations, and confidence scores.

    This is the primary BrowseAI Dev tool. It searches the web, extracts claims,
    verifies them against sources using multi-signal evidence matching, detects
    contradictions, and returns an answer with per-claim confidence scores.

    Unlike raw search, this tool fact-checks the results before returning them.
    Use this when accuracy matters — the confidence score tells you how reliable
    the answer is.
    """

    name: str = "browseaidev_answer"
    description: str = (
        "Research a question with verified, evidence-backed answers. Returns an answer "
        "with citations, per-claim verification, confidence score (0-100%), and "
        "contradiction detection. Use this when you need fact-checked information, "
        "not just search results. Supports depth='fast', 'thorough', or 'deep'."
    )
    args_schema: Type[BaseModel] = AnswerInput

    def _run(
        self,
        query: str,
        depth: str = "fast",
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        client = self._get_client()
        result = client.ask(query, depth=depth)

        parts = [f"**Answer:** {result.answer}", ""]
        parts.append(f"**Confidence:** {result.confidence:.0%}")

        if result.claims:
            parts.append(f"\n**Verified Claims ({len(result.claims)}):**")
            for i, claim in enumerate(result.claims, 1):
                status = "verified" if claim.verified else "unverified"
                parts.append(f"  {i}. [{status}] {claim.claim}")

        if result.contradictions:
            parts.append(f"\n**Contradictions Found ({len(result.contradictions)}):**")
            for c in result.contradictions:
                parts.append(f"  - {c.claim_a} vs {c.claim_b}")

        if result.sources:
            parts.append(f"\n**Sources ({len(result.sources)}):**")
            for s in result.sources:
                parts.append(f"  - [{s.title}]({s.url})")

        return "\n".join(parts)


# ── Extract Tool ─────────────────────────────────────────────────────────────


class ExtractInput(BaseModel):
    url: str = Field(description="The URL to extract knowledge from")
    query: Optional[str] = Field(default=None, description="Optional focus query to guide extraction")


class BrowseAIDevExtractTool(_BrowseAIDevBase):
    """Extract structured claims and knowledge from a specific web page.

    Use this when you have a URL and want to extract verified facts, claims,
    and structured data from it. Optionally provide a query to focus the
    extraction on specific aspects of the page.
    """

    name: str = "browseaidev_extract"
    description: str = (
        "Extract structured knowledge and verified claims from a URL. "
        "Optionally provide a query to focus extraction. Returns claims "
        "with verification status, confidence scores, and source citations."
    )
    args_schema: Type[BaseModel] = ExtractInput

    def _run(
        self,
        url: str,
        query: Optional[str] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        client = self._get_client()
        result = client.extract(url, query=query)

        parts = [f"**Extracted from:** {url}", ""]
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
    query: str = Field(description="The question to compare raw LLM vs verified answers for")


class BrowseAIDevCompareTool(_BrowseAIDevBase):
    """Compare a raw LLM answer against an evidence-backed verified answer.

    Use this to demonstrate the difference between an unverified LLM response
    and a fact-checked response. Useful for detecting hallucinations and
    showing where LLMs get things wrong.
    """

    name: str = "browseaidev_compare"
    description: str = (
        "Compare a raw LLM answer vs an evidence-backed verified answer for the "
        "same question. Shows where LLMs hallucinate and how verification improves "
        "accuracy. Returns both answers side-by-side with confidence scores."
    )
    args_schema: Type[BaseModel] = CompareInput

    def _run(
        self,
        query: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        client = self._get_client()
        result = client.compare(query)

        parts = [
            f"**Raw LLM Answer ({result.competitor.label}, unverified):**",
            result.competitor.answer,
            f"  Sources: {result.competitor.sources}",
            "",
            "**Evidence-Backed Answer (verified):**",
            result.evidence_backed.answer,
            f"  Sources: {result.evidence_backed.sources}, Claims: {result.evidence_backed.claims}",
            f"  **Confidence:** {result.evidence_backed.confidence:.0%}",
        ]

        if result.evidence_backed.citations:
            parts.append(f"\n**Citations ({len(result.evidence_backed.citations)}):**")
            for s in result.evidence_backed.citations:
                parts.append(f"  - [{s.title}]({s.url})")

        return "\n".join(parts)


# ── Clarity Tool (Anti-Hallucination) ───────────────────────────────────────


class ClarityInput(BaseModel):
    prompt: str = Field(description="The prompt to apply anti-hallucination techniques to")
    context: Optional[str] = Field(default=None, description="Optional context to ground the prompt against")
    mode: Optional[str] = Field(default=None, description="'prompt' (enhanced prompts only), 'answer' (LLM answer, default), or 'verified' (LLM + web fusion)")
    verify: bool = Field(default=False, description="Deprecated: use mode='verified' instead")


class BrowseAIDevClarityTool(_BrowseAIDevBase):
    """Clarity — anti-hallucination answer engine.

    Three modes: (1) mode='prompt': returns only enhanced system + user prompts
    (no LLM call, no internet) — use when your own LLM should answer.
    (2) mode='answer' (default): fast LLM-only answer with anti-hallucination
    grounding techniques — no internet, reduced hallucinations.
    (3) mode='verified': also runs web search pipeline and fuses the best of
    both — keeps source-backed claims, drops fabricated ones.
    """

    name: str = "browseaidev_clarity"
    description: str = (
        "Clarity — anti-hallucination answer engine. Three modes: "
        "mode='prompt' returns enhanced prompts only (no LLM call). "
        "mode='answer' (default) returns LLM answer with reduced hallucinations. "
        "mode='verified' fuses LLM + web-verified results into source-backed answer. "
        "Returns answer, claims (with origin tracking), confidence, and techniques."
    )
    args_schema: Type[BaseModel] = ClarityInput

    def _run(
        self,
        prompt: str,
        context: Optional[str] = None,
        mode: Optional[str] = None,
        verify: bool = False,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        client = self._get_client()
        result = client.clarity(prompt, context=context, mode=mode, verify=verify)

        parts = [
            f"**Intent:** {result.intent}",
            f"**Mode:** {result.mode}",
            f"**Techniques:** {', '.join(result.techniques)}",
            "",
            "**Clarity System Prompt:**",
            result.system_prompt,
            "",
            "**Clarity User Prompt:**",
            result.user_prompt,
        ]

        if result.answer:
            parts.extend(["", "**Answer:**", result.answer])

        return "\n".join(parts)
