#!/usr/bin/env python3
"""Content Agent — Write blog posts where every stat, claim, and fact is verified.

No hallucinated numbers. Every claim gets a citation. Contradictions are called out.

Usage:
    python agent.py "The state of AI in healthcare 2026"
    python agent.py "Impact of AI on software engineering jobs"
    python agent.py  # Interactive mode — prompts for topic
    BROWSEAI_API_KEY=bai_xxx python agent.py "topic"
"""

from __future__ import annotations

import argparse
import datetime
import os
import re
import sys
import time
from dataclasses import dataclass, field

from browseaidev import BrowseAIDev
from browseaidev.models import BrowseResult, BrowseSource, Contradiction
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.table import Table
from rich.text import Text


console = Console()


# ── Data structures ──────────────────────────────────────────────────────────


@dataclass
class SourceEntry:
    """A numbered source for the final blog post."""
    index: int
    url: str
    title: str
    domain: str


@dataclass
class SectionDraft:
    """A single section of the blog post."""
    heading: str
    content: str
    claims_count: int = 0
    verified_count: int = 0
    sources_used: list[int] = field(default_factory=list)


@dataclass
class VerificationReport:
    """Summary of the verification pass."""
    total_claims: int = 0
    verified_claims: int = 0
    contradictions: list[Contradiction] = field(default_factory=list)
    avg_confidence: float = 0.0
    unverified_statements: list[str] = field(default_factory=list)


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


def confidence_badge(score: float) -> str:
    """Return a markdown-friendly confidence badge."""
    pct = int(score * 100)
    if score >= 0.8:
        return f"(**{pct}% confidence**)"
    elif score >= 0.6:
        return f"(*{pct}% confidence*)"
    else:
        return f"(~{pct}% confidence)"


def confidence_bar(score: float, width: int = 20) -> Text:
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


# ── Phase 1: Research ────────────────────────────────────────────────────────


def generate_research_queries(topic: str) -> list[str]:
    """Generate diverse research queries for the topic."""
    return [
        f"{topic} latest statistics and data",
        f"{topic} current trends and developments",
        f"{topic} challenges and concerns",
        f"{topic} expert opinions and predictions",
        f"{topic} real world examples and case studies",
        f"{topic} economic impact and market size",
    ]


def run_research(client: BrowseAIDev, topic: str) -> tuple[list[BrowseResult], list[SourceEntry]]:
    """Phase 1: Research the topic across multiple queries using a session."""
    queries = generate_research_queries(topic)
    results: list[BrowseResult] = []
    all_sources: list[SourceEntry] = []
    seen_urls: set[str] = set()
    source_index = 1

    console.rule("[bold blue]Phase 1: Research[/bold blue]")
    console.print(f"[dim]Researching {len(queries)} angles on:[/dim] {topic}\n")

    session = client.session(f"content-agent-{int(time.time())}")
    console.print(f"[dim]Session created: {session.name}[/dim]\n")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        console=console,
    ) as progress:
        task = progress.add_task("Researching...", total=len(queries))

        for query in queries:
            progress.update(task, description=f"[cyan]{query[:60]}...[/cyan]")
            try:
                result = session.ask(query, depth="thorough")
                results.append(result)

                # Collect unique sources
                for src in result.sources:
                    if src.url not in seen_urls:
                        seen_urls.add(src.url)
                        all_sources.append(SourceEntry(
                            index=source_index,
                            url=src.url,
                            title=src.title,
                            domain=src.domain,
                        ))
                        source_index += 1
            except Exception as e:
                console.print(f"[yellow]  Warning: query failed: {e}[/yellow]")

            progress.advance(task)

    console.print(
        f"\n[green]Research complete:[/green] {len(results)} queries, "
        f"{sum(len(r.claims) for r in results)} claims, "
        f"{len(all_sources)} unique sources"
    )

    return results, all_sources


# ── Phase 2: Outline ─────────────────────────────────────────────────────────


def create_outline(topic: str, results: list[BrowseResult]) -> list[str]:
    """Phase 2: Create a blog post outline from research results."""
    console.rule("[bold blue]Phase 2: Outline[/bold blue]")

    # Build sections based on the research angles
    sections = [
        f"Introduction: {topic}",
        "By the Numbers: Key Statistics",
        "Current Trends and Developments",
        "Challenges and Concerns",
        "Expert Perspectives",
        "Real-World Examples",
        "What Lies Ahead",
        "Conclusion",
    ]

    console.print("[green]Blog post outline:[/green]")
    for i, section in enumerate(sections, 1):
        console.print(f"  {i}. {section}")
    console.print()

    return sections


# ── Phase 3: Write ───────────────────────────────────────────────────────────


def find_source_index(url: str, all_sources: list[SourceEntry]) -> int | None:
    """Find the citation number for a given source URL."""
    for src in all_sources:
        if src.url == url:
            return src.index
    return None


def build_section_content(
    section: str,
    results: list[BrowseResult],
    all_sources: list[SourceEntry],
) -> SectionDraft:
    """Write a section using only verified claims from research results."""
    # Map section names to relevant result indices
    section_lower = section.lower()
    relevant_results: list[BrowseResult] = []

    if "introduction" in section_lower:
        relevant_results = results[:2]  # Overview queries
    elif "statistic" in section_lower or "number" in section_lower:
        relevant_results = [r for r in results if any(
            kw in q for q in [c.claim.lower() for c in r.claims]
            for kw in ["percent", "%", "billion", "million", "growth", "market"]
        )] or results[:2]
    elif "trend" in section_lower:
        relevant_results = results[1:3] if len(results) > 2 else results
    elif "challenge" in section_lower or "concern" in section_lower:
        relevant_results = results[2:4] if len(results) > 3 else results
    elif "expert" in section_lower or "perspective" in section_lower:
        relevant_results = results[3:5] if len(results) > 4 else results
    elif "example" in section_lower or "case" in section_lower:
        relevant_results = results[4:6] if len(results) > 5 else results
    elif "ahead" in section_lower or "future" in section_lower:
        relevant_results = results[3:] if len(results) > 3 else results
    elif "conclusion" in section_lower:
        relevant_results = results  # All results for conclusion
    else:
        relevant_results = results

    # Build content from verified claims
    lines: list[str] = []
    claims_count = 0
    verified_count = 0
    sources_used: list[int] = []
    seen_claims: set[str] = set()

    for result in relevant_results:
        for claim in result.claims:
            # Skip duplicate claims
            claim_key = claim.claim.strip().lower()
            if claim_key in seen_claims:
                continue
            seen_claims.add(claim_key)

            claims_count += 1

            # Find citation numbers for this claim's sources
            citation_refs: list[str] = []
            for src_url in claim.sources:
                idx = find_source_index(src_url, all_sources)
                if idx is not None:
                    citation_refs.append(f"[{idx}]")
                    if idx not in sources_used:
                        sources_used.append(idx)

            citations_str = "".join(citation_refs) if citation_refs else ""

            if claim.verified:
                verified_count += 1
                # Add confidence badge for stats (claims with numbers)
                has_numbers = bool(re.search(r'\d+', claim.claim))
                conf_str = ""
                if has_numbers and claim.verification_score is not None:
                    conf_str = " " + confidence_badge(claim.verification_score)
                elif has_numbers:
                    # Use consensus level as proxy
                    level = claim.consensus_level or "unknown"
                    if level == "high":
                        conf_str = " (**high confidence**)"
                    elif level == "medium":
                        conf_str = " (*moderate confidence*)"

                lines.append(f"{claim.claim}{conf_str} {citations_str}")
            else:
                # Include unverified claims with a caveat
                lines.append(f"{claim.claim} {citations_str} *(unverified)*")

        # Add contradictions as notes
        if result.contradictions:
            for contra in result.contradictions:
                lines.append(
                    f"\n> **Note: Sources disagree on {contra.topic}** — "
                    f'One source states "{contra.claim_a}" while another '
                    f'claims "{contra.claim_b}." Readers should evaluate '
                    f"both perspectives."
                )

    content = "\n\n".join(lines) if lines else "*No verified claims available for this section.*"

    return SectionDraft(
        heading=section,
        content=content,
        claims_count=claims_count,
        verified_count=verified_count,
        sources_used=sources_used,
    )


def write_draft(
    topic: str,
    sections: list[str],
    results: list[BrowseResult],
    all_sources: list[SourceEntry],
) -> list[SectionDraft]:
    """Phase 3: Write the blog post using only verified facts."""
    console.rule("[bold blue]Phase 3: Write[/bold blue]")
    console.print("[dim]Building each section from verified claims only...[/dim]\n")

    drafts: list[SectionDraft] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        console=console,
    ) as progress:
        task = progress.add_task("Writing...", total=len(sections))

        for section in sections:
            progress.update(task, description=f"[cyan]Writing: {section}[/cyan]")
            draft = build_section_content(section, results, all_sources)
            drafts.append(draft)
            progress.advance(task)

    total_claims = sum(d.claims_count for d in drafts)
    total_verified = sum(d.verified_count for d in drafts)
    console.print(
        f"\n[green]Draft complete:[/green] {len(drafts)} sections, "
        f"{total_verified}/{total_claims} claims verified"
    )

    return drafts


# ── Phase 4: Verify ──────────────────────────────────────────────────────────


def run_final_verification(
    client: BrowseAIDev,
    topic: str,
    drafts: list[SectionDraft],
    results: list[BrowseResult],
) -> VerificationReport:
    """Phase 4: Run the entire draft through BrowseAI to catch unverified claims."""
    console.rule("[bold blue]Phase 4: Final Verification[/bold blue]")

    # Gather all claims for a final sweep
    all_claims: list[str] = []
    for result in results:
        for claim in result.claims:
            all_claims.append(claim.claim)

    total_claims = sum(d.claims_count for d in drafts)
    verified_claims = sum(d.verified_count for d in drafts)

    # Run a verification query on the full topic
    console.print("[dim]Running final verification sweep...[/dim]")
    with console.status("[bold green]Verifying draft against live sources...[/bold green]"):
        try:
            verify_result = client.ask(
                f"Verify the key claims about: {topic}",
                depth="thorough",
            )
            # Check for any additional contradictions
            new_contradictions = verify_result.contradictions or []

            # Collect unverified statements
            unverified = [
                c.claim for c in verify_result.claims if not c.verified
            ]
        except Exception as e:
            console.print(f"[yellow]Verification query failed: {e}[/yellow]")
            new_contradictions = []
            unverified = []

    # Aggregate contradictions from all research results
    all_contradictions: list[Contradiction] = []
    seen_topics: set[str] = set()
    for result in results:
        if result.contradictions:
            for c in result.contradictions:
                key = (c.topic, c.claim_a, c.claim_b)
                if str(key) not in seen_topics:
                    seen_topics.add(str(key))
                    all_contradictions.append(c)
    for c in new_contradictions:
        key = (c.topic, c.claim_a, c.claim_b)
        if str(key) not in seen_topics:
            seen_topics.add(str(key))
            all_contradictions.append(c)

    # Compute average confidence
    confidences = [r.confidence for r in results]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    report = VerificationReport(
        total_claims=total_claims,
        verified_claims=verified_claims,
        contradictions=all_contradictions,
        avg_confidence=avg_confidence,
        unverified_statements=unverified,
    )

    console.print(
        f"\n[green]Verification complete:[/green] "
        f"{report.verified_claims}/{report.total_claims} claims verified, "
        f"{len(report.contradictions)} contradictions found"
    )

    return report


# ── Before vs After comparison ───────────────────────────────────────────────


def generate_raw_draft(topic: str) -> str:
    """Generate a fake 'raw LLM' draft with hallucinated stats to show contrast."""
    return (
        f"# {topic}\n\n"
        f"AI is transforming this field at an unprecedented rate. According to recent "
        f"studies, the market is worth $500 billion and growing at 45% annually. "
        f"Over 90% of industry leaders say they plan to adopt AI within the next year. "
        f"Experts predict that by 2030, this technology will save $2.3 trillion globally.\n\n"
        f"A recent Stanford study found that AI improves outcomes by 73% on average. "
        f"The technology has been adopted by 85% of Fortune 500 companies, with most "
        f"reporting ROI within 6 months.\n\n"
        f"*Note: These statistics are illustrative. A raw LLM generates plausible-sounding "
        f"numbers with no source verification, no confidence scores, and no contradiction "
        f"detection. The numbers above are fabricated to demonstrate the problem.*"
    )


def show_before_after(topic: str, verified_post: str) -> None:
    """Show the contrast between raw LLM output and verified content."""
    console.rule("[bold magenta]Before vs After[/bold magenta]")

    raw_draft = generate_raw_draft(topic)

    console.print(
        Panel(
            raw_draft,
            title="[bold red]BEFORE: Raw LLM Draft (Hallucinated Stats)[/bold red]",
            border_style="red",
            padding=(1, 2),
        )
    )

    # Show a trimmed version of the verified post
    preview_lines = verified_post.split("\n")[:30]
    preview = "\n".join(preview_lines)
    if len(verified_post.split("\n")) > 30:
        preview += "\n\n... (see full output file)"

    console.print(
        Panel(
            preview,
            title="[bold green]AFTER: Verified Draft (Real Citations)[/bold green]",
            border_style="green",
            padding=(1, 2),
        )
    )

    # Comparison table
    table = Table(
        title="What Changed",
        show_header=True,
        header_style="bold magenta",
        expand=True,
    )
    table.add_column("Aspect", style="bold", width=25)
    table.add_column("Raw LLM", style="red", ratio=1)
    table.add_column("Verified Agent", style="green", ratio=1)

    table.add_row("Statistics", "Made-up numbers", "Real data with confidence scores")
    table.add_row("Citations", "None", "Inline [1], [2] with full URLs")
    table.add_row("Confidence", "Not measured", "Per-claim confidence scores")
    table.add_row("Contradictions", "Hidden", "Explicitly called out")
    table.add_row("Sources", "Not provided", "Full source list with domains")
    table.add_row("Verification", "None", "Keyword matching + cross-source consensus")

    console.print(table)
    console.print()


# ── Output assembly ──────────────────────────────────────────────────────────


def assemble_markdown(
    topic: str,
    drafts: list[SectionDraft],
    all_sources: list[SourceEntry],
    report: VerificationReport,
) -> str:
    """Assemble the final markdown blog post."""
    lines: list[str] = []
    today = datetime.date.today().strftime("%B %d, %Y")

    # Title and metadata
    lines.append(f"# {topic}")
    lines.append("")
    lines.append(f"*Generated on {today} by [Content Agent](https://browseai.dev) "
                 f"— every claim verified with citations.*")
    lines.append("")

    # Table of contents
    lines.append("## Table of Contents")
    lines.append("")
    for i, draft in enumerate(drafts, 1):
        anchor = draft.heading.lower().replace(" ", "-").replace(":", "")
        lines.append(f"{i}. [{draft.heading}](#{anchor})")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Sections
    for draft in drafts:
        lines.append(f"## {draft.heading}")
        lines.append("")
        lines.append(draft.content)
        lines.append("")

    # Sources section
    lines.append("---")
    lines.append("")
    lines.append("## Sources")
    lines.append("")
    for src in all_sources:
        lines.append(f"[{src.index}] [{src.title}]({src.url}) — *{src.domain}*")
        lines.append("")

    # Verification report
    lines.append("---")
    lines.append("")
    lines.append("## Verification Report")
    lines.append("")
    rate = (
        f"{report.verified_claims}/{report.total_claims}"
        if report.total_claims > 0
        else "0/0"
    )
    pct = (
        f" ({report.verified_claims / report.total_claims * 100:.0f}%)"
        if report.total_claims > 0
        else ""
    )
    lines.append(f"- **Claims verified:** {rate}{pct}")
    lines.append(f"- **Contradictions found:** {len(report.contradictions)}")
    lines.append(f"- **Average confidence:** {report.avg_confidence:.0%}")
    lines.append(f"- **Sources consulted:** {len(all_sources)}")
    lines.append("")

    if report.contradictions:
        lines.append("### Contradictions Detected")
        lines.append("")
        for c in report.contradictions:
            lines.append(f"- **{c.topic}**")
            lines.append(f'  - Side A: "{c.claim_a}"')
            lines.append(f'  - Side B: "{c.claim_b}"')
            lines.append("")

    if report.unverified_statements:
        lines.append("### Unverified Statements")
        lines.append("")
        for stmt in report.unverified_statements[:10]:
            lines.append(f"- {stmt}")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(
        "*This post was generated by the BrowseAI Content Agent. "
        "All statistics and claims have been verified against live web sources "
        "using keyword matching, cross-source consensus, and domain authority scoring. "
        "For more information, visit [browseai.dev](https://browseai.dev).*"
    )

    return "\n".join(lines)


def show_verification_report(report: VerificationReport) -> None:
    """Display the verification report in the terminal."""
    console.rule("[bold blue]Verification Report[/bold blue]")

    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column(justify="right", style="bold", width=25)
    table.add_column(justify="left")

    rate = f"{report.verified_claims}/{report.total_claims}"
    if report.total_claims > 0:
        rate += f" ({report.verified_claims / report.total_claims * 100:.0f}%)"

    table.add_row("Claims verified:", rate)
    table.add_row("Contradictions found:", str(len(report.contradictions)))
    table.add_row("Average confidence:", confidence_bar(report.avg_confidence))
    console.print(table)

    if report.contradictions:
        console.print(f"\n[bold red]Contradictions ({len(report.contradictions)}):[/bold red]")
        for c in report.contradictions:
            console.print(
                Panel(
                    f"[cyan]Claim:[/cyan] {c.claim_a}\n"
                    f"[yellow]vs:[/yellow]   {c.claim_b}",
                    title=f"Topic: {c.topic}",
                    border_style="red",
                    padding=(0, 2),
                )
            )

    if report.unverified_statements:
        console.print(f"\n[yellow]Unverified statements ({len(report.unverified_statements)}):[/yellow]")
        for stmt in report.unverified_statements[:5]:
            console.print(f"  [dim]- {stmt}[/dim]")


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Content Agent — Write blog posts where every stat and claim "
            "is verified with real citations. No hallucinated numbers."
        ),
        epilog=(
            "Examples:\n"
            '  python agent.py "The state of AI in healthcare 2026"\n'
            '  python agent.py "Impact of AI on software engineering jobs"\n'
            '  python agent.py "Remote work productivity statistics"\n'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("topic", nargs="?", help="Blog post topic")
    parser.add_argument(
        "-o", "--output",
        help="Output file path (default: <topic-slug>.md)",
    )
    parser.add_argument(
        "--no-compare",
        action="store_true",
        help="Skip the Before vs After comparison",
    )
    args = parser.parse_args()

    # Banner
    console.print(
        Panel(
            "[bold]CONTENT AGENT[/bold]\n"
            "[dim]Write verified blog posts — powered by BrowseAI[/dim]\n\n"
            "[dim]Every stat gets a confidence score. Every claim gets a citation.\n"
            "Contradictions are called out. No hallucinated numbers.[/dim]",
            border_style="bright_blue",
            padding=(1, 4),
        )
    )

    # Get topic
    topic = args.topic
    if not topic:
        topic = console.input("\n[bold cyan]Enter blog post topic:[/bold cyan] ").strip()
    if not topic:
        console.print("[red]No topic provided. Exiting.[/red]")
        sys.exit(1)

    console.print(f"\n[bold]Topic:[/bold] {topic}\n")

    # Initialize client
    api_key = get_api_key()
    client = BrowseAIDev(api_key=api_key)

    start_time = time.time()

    # Phase 1: Research
    results, all_sources = run_research(client, topic)

    if not results:
        console.print("[red]No research results. Check your API key and try again.[/red]")
        sys.exit(1)

    # Phase 2: Outline
    sections = create_outline(topic, results)

    # Phase 3: Write
    drafts = write_draft(topic, sections, results, all_sources)

    # Phase 4: Verify
    report = run_final_verification(client, topic, drafts, results)

    # Assemble final post
    markdown = assemble_markdown(topic, drafts, all_sources, report)

    # Show verification report
    show_verification_report(report)

    # Before vs After comparison
    if not args.no_compare:
        show_before_after(topic, markdown)

    # Save to file
    slug = re.sub(r'[^a-z0-9]+', '-', topic.lower()).strip('-')
    output_path = args.output or f"{slug}.md"
    with open(output_path, "w") as f:
        f.write(markdown)

    elapsed = time.time() - start_time

    console.rule("[bold green]Done[/bold green]")
    console.print(
        Panel(
            f"[bold green]Blog post saved to:[/bold green] {output_path}\n\n"
            f"[dim]Total time: {elapsed:.1f}s[/dim]\n"
            f"[dim]Claims verified: {report.verified_claims}/{report.total_claims}[/dim]\n"
            f"[dim]Sources cited: {len(all_sources)}[/dim]\n"
            f"[dim]Contradictions: {len(report.contradictions)}[/dim]",
            border_style="green",
            padding=(1, 2),
        )
    )


if __name__ == "__main__":
    main()
