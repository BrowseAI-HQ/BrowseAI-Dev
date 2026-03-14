#!/usr/bin/env python3
"""Coding Agent — Research before you write, so you never ship hallucinated APIs.

An AI coding agent that uses BrowseAI to verify libraries, check for deprecations,
and find current best practices BEFORE generating code. No more recommending
packages that don't exist or APIs that were removed three versions ago.

Usage:
    python agent.py "Build a WebSocket server in Python"
    python agent.py "Create a REST API with JWT authentication"
    python agent.py  # Interactive mode
    BROWSEAI_API_KEY=bai_xxx python agent.py "Build a rate limiter in Python"
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
import textwrap

from browseai import BrowseAI
from browseai.models import BrowseResult
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.syntax import Syntax
from rich.columns import Columns
from rich.rule import Rule


console = Console()


# ── Helpers ──────────────────────────────────────────────────────────────────


def get_api_key() -> str:
    """Resolve API key from env or prompt."""
    key = os.environ.get("BROWSEAI_API_KEY", "")
    if key:
        return key
    console.print(
        "[dim]Tip: set BROWSEAI_API_KEY env var to skip this prompt.[/dim]"
    )
    key = console.input("[bold]Enter your BrowseAI API key:[/bold] ").strip()
    if not key:
        console.print("[red]No API key provided. Exiting.[/red]")
        sys.exit(1)
    return key


def confidence_bar(score: float, width: int = 15) -> Text:
    """Render a colored progress bar for confidence."""
    filled = int(score * width)
    if score >= 0.7:
        color = "green"
    elif score >= 0.4:
        color = "yellow"
    else:
        color = "red"
    bar = Text()
    bar.append("█" * filled, style=color)
    bar.append("░" * (width - filled), style="dim")
    bar.append(f" {score:.0%}", style=f"bold {color}")
    return bar


def extract_libraries(result: BrowseResult) -> list[str]:
    """Extract library/package names mentioned in claims and answer.

    Looks for common patterns like backtick-quoted names, PyPI-style names,
    and known library references in the answer text.
    """
    text = result.answer
    for claim in result.claims:
        text += " " + claim.claim

    # Find backtick-quoted names (e.g., `websockets`, `fastapi`)
    backtick_libs = re.findall(r"`([a-zA-Z][a-zA-Z0-9_-]{1,30})`", text)

    # Find "library_name library/package/module" patterns
    word_libs = re.findall(
        r"\b([a-zA-Z][a-zA-Z0-9_-]{1,30})\s+(?:library|package|module|framework)\b",
        text,
        re.IGNORECASE,
    )

    # Combine and deduplicate, preserving order
    seen: set[str] = set()
    libs: list[str] = []
    for name in backtick_libs + word_libs:
        lower = name.lower().strip()
        # Filter out common English words that aren't libraries
        if lower in {
            "the", "a", "an", "this", "that", "each", "python", "javascript",
            "standard", "built", "open", "source", "third", "party", "popular",
            "recommended", "latest", "modern", "async", "server", "client",
            "example", "code", "function", "class", "method", "type", "use",
        }:
            continue
        if lower not in seen:
            seen.add(lower)
            libs.append(name)
    return libs


def extract_code_block(text: str) -> str | None:
    """Pull the first fenced code block from text."""
    match = re.search(r"```(?:python)?\s*\n(.*?)```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return None


# ── Agent Phases ─────────────────────────────────────────────────────────────


def phase_research(session, task: str) -> BrowseResult:
    """Phase 1: Research the best libraries and approaches for the task."""
    console.print()
    console.rule("[bold cyan]Phase 1: Research[/bold cyan]")
    console.print(
        f"\n[dim]Researching best libraries and approaches for:[/dim]"
        f"\n[bold]{task}[/bold]\n"
    )

    query = (
        f"What are the best Python libraries and frameworks to {task.lower().rstrip('.')}? "
        f"List the most popular, actively maintained options with their key features. "
        f"Include the correct pip install names."
    )

    with console.status("[bold green]Searching the web and extracting knowledge...[/bold green]"):
        start = time.time()
        result = session.ask(query, depth="thorough")
        elapsed = time.time() - start

    # Display research findings
    console.print(
        Panel(
            result.answer,
            title="Research Findings",
            subtitle=f"[dim]{elapsed:.1f}s | {len(result.sources)} sources[/dim]",
            border_style="cyan",
            padding=(1, 2),
        )
    )

    # Show confidence and claims
    console.print(f"\n  Confidence: ", end="")
    console.print(confidence_bar(result.confidence))
    console.print(f"  Verified claims: {sum(1 for c in result.claims if c.verified)}/{len(result.claims)}")
    console.print(f"  Sources consulted: {len(result.sources)}")

    if result.contradictions:
        console.print(f"  [yellow]Contradictions found: {len(result.contradictions)}[/yellow]")
        for c in result.contradictions:
            console.print(f"    [dim]- {c.claim_a} vs {c.claim_b}[/dim]")

    return result


def phase_verify(session, research: BrowseResult) -> list[dict]:
    """Phase 2: Verify each recommended library actually exists and isn't deprecated."""
    console.print()
    console.rule("[bold yellow]Phase 2: Verification[/bold yellow]")

    libraries = extract_libraries(research)
    if not libraries:
        console.print("[dim]No specific libraries detected to verify.[/dim]")
        return []

    console.print(
        f"\n[dim]Found {len(libraries)} libraries to verify:[/dim] "
        + ", ".join(f"[bold]{lib}[/bold]" for lib in libraries)
        + "\n"
    )

    verified: list[dict] = []

    for lib in libraries:
        query = (
            f"Is the Python package '{lib}' currently maintained and available on PyPI? "
            f"What is the latest version? Is it deprecated or has it been replaced by something else? "
            f"When was the last release?"
        )

        with console.status(f"[bold green]Verifying {lib}...[/bold green]"):
            start = time.time()
            result = session.ask(query)
            elapsed = time.time() - start

        # Determine status from the answer
        answer_lower = result.answer.lower()
        is_deprecated = any(
            term in answer_lower
            for term in ["deprecated", "no longer maintained", "abandoned", "archived", "end of life", "unmaintained"]
        )
        exists = result.confidence > 0.3 and not any(
            term in answer_lower
            for term in ["does not exist", "no such package", "not found on pypi", "not a real"]
        )

        if is_deprecated:
            status_icon = "[red]DEPRECATED[/red]"
            status_style = "red"
        elif exists:
            status_icon = "[green]VERIFIED[/green]"
            status_style = "green"
        else:
            status_icon = "[red]NOT FOUND[/red]"
            status_style = "red"

        entry = {
            "name": lib,
            "exists": exists,
            "deprecated": is_deprecated,
            "confidence": result.confidence,
            "summary": result.answer[:200],
            "sources": result.sources,
            "status_style": status_style,
        }
        verified.append(entry)

        console.print(
            f"  {status_icon} [bold]{lib}[/bold] "
            f"[dim]({elapsed:.1f}s, confidence: {result.confidence:.0%})[/dim]"
        )

    # Summary table
    console.print()
    table = Table(
        title="Library Verification Results",
        show_header=True,
        header_style="bold magenta",
        padding=(0, 1),
    )
    table.add_column("Library", style="bold", width=20)
    table.add_column("Status", justify="center", width=14)
    table.add_column("Confidence", justify="center", width=14)
    table.add_column("Notes", ratio=1)

    for v in verified:
        if v["deprecated"]:
            status = Text("DEPRECATED", style="bold red")
        elif v["exists"]:
            status = Text("VERIFIED", style="bold green")
        else:
            status = Text("NOT FOUND", style="bold red")

        table.add_row(
            v["name"],
            status,
            confidence_bar(v["confidence"], width=8),
            Text(v["summary"][:80] + "...", style="dim"),
        )

    console.print(table)

    return verified


def phase_generate(session, task: str, research: BrowseResult, verified: list[dict]) -> str:
    """Phase 3: Generate code using only verified, non-deprecated libraries."""
    console.print()
    console.rule("[bold green]Phase 3: Code Generation[/bold green]")

    # Build context from verified libraries
    safe_libs = [v["name"] for v in verified if v["exists"] and not v["deprecated"]]
    unsafe_libs = [v["name"] for v in verified if v["deprecated"] or not v["exists"]]

    if safe_libs:
        console.print(
            f"\n[green]Using verified libraries:[/green] "
            + ", ".join(f"[bold]{lib}[/bold]" for lib in safe_libs)
        )
    if unsafe_libs:
        console.print(
            f"[red]Excluding unsafe libraries:[/red] "
            + ", ".join(f"[bold]{lib}[/bold]" for lib in unsafe_libs)
        )

    # Ask BrowseAI to generate code with the verified context
    lib_context = ""
    if safe_libs:
        lib_context = f"Use ONLY these verified libraries: {', '.join(safe_libs)}. "
    if unsafe_libs:
        lib_context += f"Do NOT use these (deprecated/nonexistent): {', '.join(unsafe_libs)}. "

    query = (
        f"Write a complete, working Python code example to {task.lower().rstrip('.')}. "
        f"{lib_context}"
        f"Include proper error handling, type hints, and comments explaining key decisions. "
        f"Wrap the code in a ```python code block."
    )

    with console.status("[bold green]Generating verified code...[/bold green]"):
        start = time.time()
        result = session.ask(query, depth="thorough")
        elapsed = time.time() - start

    code = extract_code_block(result.answer)
    if not code:
        # If no code block found, show the full answer
        code = result.answer

    console.print(
        Panel(
            Syntax(code, "python", theme="monokai", line_numbers=True),
            title="Generated Code (Research-Backed)",
            subtitle=f"[dim]{elapsed:.1f}s[/dim]",
            border_style="green",
            padding=(1, 1),
        )
    )

    # Show why each library was chosen with citations
    if safe_libs:
        console.print("\n[bold]Why these libraries?[/bold]\n")
        for lib in safe_libs:
            # Find relevant claims mentioning this library
            reasons = []
            for claim in research.claims:
                if lib.lower() in claim.claim.lower():
                    source_count = len(claim.sources)
                    consensus = claim.consensus_level or "unknown"
                    reasons.append(
                        f"{claim.claim} "
                        f"[dim](consensus: {consensus}, {source_count} sources)[/dim]"
                    )
            if reasons:
                console.print(f"  [bold cyan]{lib}[/bold cyan]")
                for reason in reasons[:2]:
                    console.print(f"    {reason}")
            else:
                console.print(
                    f"  [bold cyan]{lib}[/bold cyan] "
                    f"[dim]— recommended by research findings[/dim]"
                )

    return code


def show_comparison(task: str) -> None:
    """Show the 'Without BrowseAI' vs 'With BrowseAI' comparison."""
    console.print()
    console.rule("[bold]Without BrowseAI vs With BrowseAI[/bold]")
    console.print()

    without = Panel(
        "[red]1.[/red] Agent receives task\n"
        "[red]2.[/red] LLM generates code from training data\n"
        "[red]3.[/red] Might recommend deprecated packages\n"
        "[red]4.[/red] Might hallucinate non-existent APIs\n"
        "[red]5.[/red] No verification of library existence\n"
        "[red]6.[/red] Version info may be outdated\n"
        "\n"
        "[bold red]Risk:[/bold red] Code uses packages that don't\n"
        "exist or APIs that were removed, breaking\n"
        "at install time or runtime.",
        title="Without BrowseAI",
        border_style="red",
        padding=(1, 2),
    )

    with_browseai = Panel(
        "[green]1.[/green] Agent receives task\n"
        "[green]2.[/green] Researches best libraries (real-time search)\n"
        "[green]3.[/green] Verifies each library on PyPI\n"
        "[green]4.[/green] Checks for deprecation notices\n"
        "[green]5.[/green] Confirms latest version & API patterns\n"
        "[green]6.[/green] Generates code with citations\n"
        "\n"
        "[bold green]Result:[/bold green] Every import in the generated\n"
        "code maps to a real, maintained package\n"
        "with verified API usage.",
        title="With BrowseAI",
        border_style="green",
        padding=(1, 2),
    )

    console.print(Columns([without, with_browseai], padding=(0, 2), expand=True))


def show_session_knowledge(session) -> None:
    """Display accumulated session knowledge."""
    try:
        entries = session.knowledge(limit=20)
    except Exception:
        return

    if not entries:
        return

    console.print()
    console.rule("[bold]Session Knowledge (Accumulated)[/bold]")
    console.print(
        f"\n[dim]The session has accumulated {len(entries)} knowledge entries "
        f"that persist across tasks.[/dim]\n"
    )

    table = Table(
        show_header=True,
        header_style="bold blue",
        padding=(0, 1),
        expand=True,
    )
    table.add_column("#", width=4, justify="right")
    table.add_column("Knowledge", ratio=3)
    table.add_column("Verified", justify="center", width=10)
    table.add_column("Origin", ratio=1)

    for i, entry in enumerate(entries[:10], 1):
        table.add_row(
            str(i),
            Text(entry.claim[:100] + ("..." if len(entry.claim) > 100 else ""), style="white"),
            Text("Yes", style="green") if entry.verified else Text("No", style="dim"),
            Text(entry.origin_query[:40] + "...", style="dim"),
        )

    console.print(table)

    if len(entries) > 10:
        console.print(f"\n[dim]  ... and {len(entries) - 10} more entries[/dim]")


# ── Main ─────────────────────────────────────────────────────────────────────


def run_agent(task: str, api_key: str) -> None:
    """Run the full coding agent pipeline for a single task."""
    client = BrowseAI(api_key=api_key)

    # Create a session so knowledge accumulates across tasks
    session = client.session("coding-agent")

    console.print(
        Panel(
            f"[bold]{task}[/bold]",
            title="Coding Task",
            border_style="bright_blue",
            padding=(1, 2),
        )
    )

    # Phase 1: Research
    research = phase_research(session, task)

    # Phase 2: Verify libraries
    verified = phase_verify(session, research)

    # Phase 3: Generate code
    code = phase_generate(session, task, research, verified)

    # Show comparison
    show_comparison(task)

    # Show accumulated session knowledge
    show_session_knowledge(session)

    # Sources
    console.print("\n[dim]All sources consulted during this task:[/dim]")
    recalled = session.recall(task, limit=20)
    seen_urls: set[str] = set()
    for entry in recalled.entries:
        for src in entry.sources:
            if src not in seen_urls:
                seen_urls.add(src)
                console.print(f"  [dim]{src}[/dim]")

    console.print(
        f"\n[dim]Session '{session.name}' retained — "
        f"run another task to build on this knowledge.[/dim]\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "AI Coding Agent that researches before writing code. "
            "Uses BrowseAI to verify libraries and check for deprecations."
        ),
        epilog=(
            "Examples:\n"
            '  python agent.py "Build a WebSocket server in Python"\n'
            '  python agent.py "Create a REST API with JWT authentication"\n'
            '  python agent.py "Build a rate limiter in Python"\n'
            '  python agent.py "Create a CLI tool with auto-complete"\n'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("task", nargs="?", help="The coding task to accomplish")
    args = parser.parse_args()

    # Banner
    console.print(
        Panel(
            "[bold]CODING AGENT[/bold]\n"
            "[dim]Research-first code generation powered by BrowseAI[/dim]\n\n"
            "[dim]Research  ->  Verify  ->  Generate[/dim]",
            border_style="bright_blue",
            padding=(1, 4),
        )
    )

    # Get task
    task = args.task
    if not task:
        task = console.input(
            "\n[bold]What should I build?[/bold] "
        ).strip()
    if not task:
        console.print("[red]No task provided. Exiting.[/red]")
        sys.exit(1)

    # Get API key
    api_key = get_api_key()

    # Run the agent
    run_agent(task, api_key)

    # Offer to do another task (interactive mode)
    while True:
        console.print()
        next_task = console.input(
            "[bold]Another task? (enter to quit):[/bold] "
        ).strip()
        if not next_task:
            console.print("[dim]Goodbye![/dim]")
            break
        run_agent(next_task, api_key)


if __name__ == "__main__":
    main()
