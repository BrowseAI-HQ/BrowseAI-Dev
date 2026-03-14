"""
Support Agent — A customer support agent powered by BrowseAI Dev.

Verifies answers against multiple sources before responding. Escalates to
humans when confidence is low. Tracks verified answers in a session-based
knowledge base so repeated questions get instant, reliable responses.

Usage:
    python agent.py
    python agent.py --knowledge-base https://docs.example.com

Environment:
    BROWSEAI_API_KEY  — BrowseAI API key (starts with bai_)
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from dataclasses import dataclass, field

from browseai import BrowseAI
from dotenv import load_dotenv
from rich.console import Console
from rich.live import Live
from rich.markdown import Markdown
from rich.panel import Panel
from rich.progress import SpinnerColumn, Progress, TextColumn
from rich.table import Table
from rich.text import Text
from rich.theme import Theme

load_dotenv()

# ── Theme ─────────────────────────────────────────────────────────────────────

THEME = Theme(
    {
        "high": "bold green",
        "medium": "bold yellow",
        "low": "bold red",
        "info": "cyan",
        "step": "dim",
        "agent": "bold blue",
        "user": "bold white",
        "escalate": "bold red",
    }
)

console = Console(theme=THEME)

# ── Constants ─────────────────────────────────────────────────────────────────

HIGH_CONFIDENCE = 0.70
MEDIUM_CONFIDENCE = 0.50


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class CachedAnswer:
    """A previously verified answer stored in the local knowledge base."""
    question: str
    answer: str
    confidence: float
    sources: list[str]
    times_used: int = 0


@dataclass
class AgentStats:
    """Tracks agent performance over the session."""
    total_questions: int = 0
    auto_answered: int = 0
    flagged: int = 0
    escalated: int = 0
    cache_hits: int = 0
    avg_confidence: float = 0.0
    _confidences: list[float] = field(default_factory=list)

    def record(self, confidence: float, action: str) -> None:
        self.total_questions += 1
        self._confidences.append(confidence)
        self.avg_confidence = sum(self._confidences) / len(self._confidences)
        if action == "answered":
            self.auto_answered += 1
        elif action == "flagged":
            self.flagged += 1
        elif action == "escalated":
            self.escalated += 1

    def record_cache_hit(self) -> None:
        self.cache_hits += 1


# ── Agent ─────────────────────────────────────────────────────────────────────

class SupportAgent:
    """Customer support agent that verifies answers before responding."""

    def __init__(self, api_key: str, knowledge_base_url: str | None = None):
        self.client = BrowseAI(api_key=api_key, timeout=120.0)
        self.knowledge_base_url = knowledge_base_url
        self.session_client = None
        self.cache: dict[str, CachedAnswer] = {}
        self.stats = AgentStats()

    def start_session(self) -> None:
        """Initialize a BrowseAI research session for knowledge accumulation."""
        self.session_client = self.client.session("support-agent")
        console.print(
            f"  Session started: [info]{self.session_client.id}[/info]",
            style="step",
        )

    def _find_cached(self, question: str) -> CachedAnswer | None:
        """Check if we have a high-confidence cached answer."""
        q_lower = question.lower().strip()
        for key, cached in self.cache.items():
            if key in q_lower or q_lower in key:
                if cached.confidence >= HIGH_CONFIDENCE:
                    cached.times_used += 1
                    self.stats.record_cache_hit()
                    return cached
        return None

    def _show_step(self, step: str) -> None:
        console.print(f"  [step]{step}[/step]")

    def _confidence_style(self, confidence: float) -> str:
        if confidence >= HIGH_CONFIDENCE:
            return "high"
        elif confidence >= MEDIUM_CONFIDENCE:
            return "medium"
        return "low"

    def _confidence_label(self, confidence: float) -> str:
        pct = round(confidence * 100)
        if confidence >= HIGH_CONFIDENCE:
            return f"HIGH ({pct}%)"
        elif confidence >= MEDIUM_CONFIDENCE:
            return f"MEDIUM ({pct}%)"
        return f"LOW ({pct}%)"

    def _format_decision_flow(self, question: str, confidence: float, action: str) -> Panel:
        """Build a visual decision flow panel."""
        style = self._confidence_style(confidence)
        label = self._confidence_label(confidence)

        flow = Text()
        flow.append("  Question ", style="dim")
        flow.append("-->", style="dim")
        flow.append(" Research ", style="info")
        flow.append("-->", style="dim")
        flow.append(f" Confidence: ", style="dim")
        flow.append(label, style=style)
        flow.append(" --> ", style="dim")

        if action == "answered":
            flow.append("RESPOND DIRECTLY", style="high")
        elif action == "flagged":
            flow.append("RESPOND WITH CAVEAT", style="medium")
        else:
            flow.append("ESCALATE TO HUMAN", style="escalate")

        return Panel(flow, title="Decision Flow", border_style="dim")

    def research(self, question: str) -> None:
        """Research a customer question and respond based on confidence."""

        # ── Step 1: Check cache ───────────────────────────────────────────
        self._show_step("Checking knowledge base...")
        cached = self._find_cached(question)
        if cached:
            console.print()
            console.print(
                self._format_decision_flow(question, cached.confidence, "answered")
            )
            console.print()
            panel = Panel(
                Markdown(cached.answer),
                title="[agent]Support Agent[/agent] (from knowledge base)",
                border_style="green",
                subtitle=f"Confidence: {round(cached.confidence * 100)}% | Used {cached.times_used}x",
            )
            console.print(panel)
            self.stats.record(cached.confidence, "answered")
            return

        # ── Step 2: Research via BrowseAI ─────────────────────────────────
        self._show_step("Searching and verifying across multiple sources...")

        query = question
        if self.knowledge_base_url:
            query = f"{question} site:{self.knowledge_base_url}"

        start_time = time.time()

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task("Researching...", total=None)

            try:
                if self.session_client:
                    result = self.session_client.ask(query, depth="thorough")
                else:
                    result = self.client.ask(query, depth="thorough")
            except Exception as exc:
                console.print(f"\n  [low]Research failed: {exc}[/low]")
                console.print(
                    "  [escalate]>> Escalating to human support team.[/escalate]\n"
                )
                self.stats.record(0.0, "escalated")
                return

        elapsed = time.time() - start_time

        # ── Step 3: Show trace ────────────────────────────────────────────
        if hasattr(result, "trace") and result.trace:
            trace_table = Table(show_header=False, box=None, padding=(0, 2))
            for t in result.trace:
                trace_table.add_row(
                    f"[step]{t.step}[/step]",
                    f"[dim]{t.duration_ms}ms[/dim]",
                )
            console.print(trace_table)

        confidence = result.confidence
        style = self._confidence_style(confidence)

        # ── Step 4: Display source summary ────────────────────────────────
        if result.sources:
            self._show_step(
                f"Verified across {len(result.sources)} source(s) in {elapsed:.1f}s"
            )
            for s in result.sources[:3]:
                console.print(f"    [dim]{s.domain}[/dim] - {s.title}")

        # ── Step 5: Show claims verification ──────────────────────────────
        if result.claims:
            verified = sum(1 for c in result.claims if c.verified)
            total = len(result.claims)
            self._show_step(f"Claims: {verified}/{total} verified")

        # ── Step 6: Show contradictions ───────────────────────────────────
        if result.contradictions:
            console.print()
            for c in result.contradictions:
                console.print(f"  [low]Contradiction:[/low] {c.topic}")
                console.print(f"    [dim]A: {c.claim_a}[/dim]")
                console.print(f"    [dim]B: {c.claim_b}[/dim]")

        # ── Step 7: Decide and respond ────────────────────────────────────
        if confidence >= HIGH_CONFIDENCE:
            action = "answered"
        elif confidence >= MEDIUM_CONFIDENCE:
            action = "flagged"
        else:
            action = "escalated"

        console.print()
        console.print(self._format_decision_flow(question, confidence, action))
        console.print()

        if action == "answered":
            # High confidence -- respond directly with citations
            source_list = ""
            if result.sources:
                source_list = "\n\n**Sources:**\n"
                for s in result.sources[:3]:
                    source_list += f"- [{s.title}]({s.url})\n"

            panel = Panel(
                Markdown(result.answer + source_list),
                title="[agent]Support Agent[/agent]",
                border_style="green",
                subtitle=f"Confidence: {round(confidence * 100)}% | {len(result.sources)} sources",
            )
            console.print(panel)

        elif action == "flagged":
            # Medium confidence -- respond but flag uncertainty
            caveat = (
                "> **Note:** I'm not fully certain about this answer. "
                "Here's what I found from available sources, but you may want "
                "to verify with our team for the most accurate information.\n\n"
            )
            source_list = ""
            if result.sources:
                source_list = "\n\n**Sources consulted:**\n"
                for s in result.sources[:3]:
                    source_list += f"- [{s.title}]({s.url})\n"

            panel = Panel(
                Markdown(caveat + result.answer + source_list),
                title="[agent]Support Agent[/agent] (flagged for review)",
                border_style="yellow",
                subtitle=f"Confidence: {round(confidence * 100)}% | Needs verification",
            )
            console.print(panel)

        else:
            # Low confidence -- escalate to human
            summary = (
                f"**Research Summary for Human Agent:**\n\n"
                f"**Customer question:** {question}\n\n"
                f"**Best answer found (confidence {round(confidence * 100)}%):**\n"
                f"{result.answer}\n\n"
            )
            if result.sources:
                summary += "**Sources checked:**\n"
                for s in result.sources[:5]:
                    summary += f"- {s.title} ({s.domain})\n"
            if result.contradictions:
                summary += f"\n**Contradictions found:** {len(result.contradictions)}\n"
                for c in result.contradictions:
                    summary += f"- {c.topic}: conflicting information across sources\n"

            panel = Panel(
                Markdown(summary),
                title="[escalate]ESCALATED TO HUMAN SUPPORT[/escalate]",
                border_style="red",
                subtitle="Confidence too low for automated response",
            )
            console.print(panel)

        # ── Step 8: Cache the answer ──────────────────────────────────────
        if confidence >= HIGH_CONFIDENCE:
            q_key = question.lower().strip()
            source_urls = [s.url for s in result.sources[:5]] if result.sources else []
            self.cache[q_key] = CachedAnswer(
                question=question,
                answer=result.answer,
                confidence=confidence,
                sources=source_urls,
            )

        self.stats.record(confidence, action)

    def show_stats(self) -> None:
        """Display session statistics."""
        s = self.stats
        if s.total_questions == 0:
            console.print("[dim]No questions answered yet.[/dim]")
            return

        table = Table(title="Session Statistics", border_style="dim")
        table.add_column("Metric", style="info")
        table.add_column("Value", justify="right")

        table.add_row("Total questions", str(s.total_questions))
        table.add_row(
            "Auto-answered (>= 70%)",
            f"[high]{s.auto_answered}[/high]",
        )
        table.add_row(
            "Flagged (50-70%)",
            f"[medium]{s.flagged}[/medium]",
        )
        table.add_row(
            "Escalated (< 50%)",
            f"[low]{s.escalated}[/low]",
        )
        table.add_row("Knowledge base hits", str(s.cache_hits))
        table.add_row(
            "Avg confidence",
            f"{round(s.avg_confidence * 100)}%",
        )
        table.add_row(
            "Knowledge base size",
            str(len(self.cache)),
        )

        console.print()
        console.print(table)

    def show_knowledge_base(self) -> None:
        """Display cached verified answers."""
        if not self.cache:
            console.print("[dim]Knowledge base is empty.[/dim]")
            return

        table = Table(title="Knowledge Base", border_style="dim")
        table.add_column("Question", style="info", max_width=50)
        table.add_column("Confidence", justify="center")
        table.add_column("Used", justify="center")
        table.add_column("Sources", justify="center")

        for cached in self.cache.values():
            style = self._confidence_style(cached.confidence)
            table.add_row(
                cached.question[:50],
                f"[{style}]{round(cached.confidence * 100)}%[/{style}]",
                str(cached.times_used),
                str(len(cached.sources)),
            )

        console.print()
        console.print(table)

    def close(self) -> None:
        self.client.close()


# ── CLI ───────────────────────────────────────────────────────────────────────

BANNER = """
[agent]Customer Support Agent[/agent]
[dim]Powered by BrowseAI Dev — answers verified before delivery[/dim]

[dim]Commands:[/dim]
  [info]/stats[/info]      Show session statistics
  [info]/kb[/info]         Show knowledge base
  [info]/help[/info]       Show this help
  [info]/quit[/info]       Exit

[dim]Ask any customer support question to get started.[/dim]
"""


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Customer support agent with verified answers"
    )
    parser.add_argument(
        "--knowledge-base",
        type=str,
        default=None,
        help="URL of company docs to prioritize in search (e.g., https://docs.example.com)",
    )
    args = parser.parse_args()

    api_key = os.environ.get("BROWSEAI_API_KEY", "bai_xxx")
    agent = SupportAgent(api_key=api_key, knowledge_base_url=args.knowledge_base)

    console.print(Panel(BANNER, border_style="blue", title="Support Agent"))

    # Start a research session for knowledge accumulation
    try:
        agent.start_session()
    except Exception:
        console.print("  [dim]Running without session (knowledge won't persist)[/dim]")

    if args.knowledge_base:
        console.print(
            f"  [info]Knowledge base:[/info] {args.knowledge_base}"
        )
    console.print()

    try:
        while True:
            try:
                question = console.input("[user]Customer > [/user]")
            except EOFError:
                break

            question = question.strip()
            if not question:
                continue

            if question.lower() in ("/quit", "/exit", "/q"):
                agent.show_stats()
                break
            elif question.lower() == "/stats":
                agent.show_stats()
                continue
            elif question.lower() == "/kb":
                agent.show_knowledge_base()
                continue
            elif question.lower() == "/help":
                console.print(BANNER)
                continue

            console.print()
            agent.research(question)
            console.print()

    except KeyboardInterrupt:
        console.print("\n")
        agent.show_stats()
    finally:
        agent.close()
        console.print("[dim]Session ended.[/dim]")


if __name__ == "__main__":
    main()
