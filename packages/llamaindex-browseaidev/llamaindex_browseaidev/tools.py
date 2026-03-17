"""BrowseAI Dev tools for LlamaIndex agents."""

from __future__ import annotations

from typing import Any

from llama_index.core.tools import FunctionTool

from browseaidev import BrowseAIDev


def _get_client(api_key: str, base_url: str = "https://browseai.dev/api") -> BrowseAIDev:
    return BrowseAIDev(api_key=api_key, base_url=base_url)


def BrowseAIDevSearchTool(api_key: str, base_url: str = "https://browseai.dev/api") -> FunctionTool:
    """Create a LlamaIndex tool for web search."""
    client = _get_client(api_key, base_url)

    def search(query: str, limit: int = 5) -> str:
        """Search the web for information. Returns ranked results with URLs, titles, and snippets."""
        results = client.search(query, limit=limit)
        lines = []
        for i, r in enumerate(results, 1):
            lines.append(f"{i}. [{r.title}]({r.url})")
            if r.snippet:
                lines.append(f"   {r.snippet}")
        return "\n".join(lines) if lines else "No results found."

    return FunctionTool.from_defaults(fn=search, name="browseaidev_search")


def BrowseAIDevAnswerTool(api_key: str, base_url: str = "https://browseai.dev/api") -> FunctionTool:
    """Create a LlamaIndex tool for verified research with citations and confidence scores.

    This is the primary BrowseAI Dev tool. It searches the web, verifies claims
    using BM25 + NLI semantic entailment, detects contradictions, and returns
    an answer with per-claim confidence scores.
    """
    client = _get_client(api_key, base_url)

    def answer(query: str, depth: str = "fast") -> str:
        """Research a question with verified, evidence-backed answers. Returns citations, confidence score, and contradiction detection. depth: 'fast', 'thorough', or 'deep'."""
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

    return FunctionTool.from_defaults(fn=answer, name="browseaidev_answer")


def BrowseAIDevExtractTool(api_key: str, base_url: str = "https://browseai.dev/api") -> FunctionTool:
    """Create a LlamaIndex tool for extracting structured claims from a URL."""
    client = _get_client(api_key, base_url)

    def extract(url: str, query: str | None = None) -> str:
        """Extract structured claims and knowledge from a web page. Optionally provide a query to focus extraction."""
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

    return FunctionTool.from_defaults(fn=extract, name="browseaidev_extract")


def BrowseAIDevCompareTool(api_key: str, base_url: str = "https://browseai.dev/api") -> FunctionTool:
    """Create a LlamaIndex tool for comparing raw LLM vs verified answers."""
    client = _get_client(api_key, base_url)

    def compare(query: str) -> str:
        """Compare a raw LLM answer vs an evidence-backed verified answer. Shows where LLMs hallucinate."""
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

    return FunctionTool.from_defaults(fn=compare, name="browseaidev_compare")
