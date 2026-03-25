#!/usr/bin/env python3
"""Docs Verifier — Crawl documentation, extract factual claims, verify each one.

Uses BrowseAI to fetch remote docs and verify claims against live web sources.
Flags outdated or contradicted statements with confidence scores.

Usage:
    # Verify a remote README
    python verify_docs.py https://github.com/BrowseAI-HQ/BrowseAI-Dev/blob/main/README.md

    # Verify a local markdown file
    python verify_docs.py ./README.md

    # Use thorough mode for deeper verification
    python verify_docs.py ./README.md --depth thorough

    # Export results as markdown
    python verify_docs.py ./README.md --output report.md
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

from browseaidev import BrowseAIDev
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

console = Console()


# ---------------------------------------------------------------------------
# Claim extraction
# ---------------------------------------------------------------------------

# Patterns that indicate a sentence contains a verifiable factual claim.
CLAIM_PATTERNS = [
    re.compile(r"\b\d{4}\b"),                    # years
    re.compile(r"\b\d+[\d,]*\+?\s*(?:users?|downloads?|stars?|forks?|contributors?|"
               r"domains?|results?|sources?|endpoints?|queries|requests?)", re.I),  # counts
    re.compile(r"\b(?:is|was|are|were|has|have|had)\b", re.I),  # state assertions
    re.compile(r"\b(?:faster|slower|better|worse|more|less|larger|smaller)\s+than\b", re.I),  # comparisons
    re.compile(r"\b(?:supports?|provides?|includes?|contains?|uses?|requires?)\b", re.I),  # capability claims
    re.compile(r"\b(?:MIT|Apache|GPL|BSD)\b"),    # license claims
    re.compile(r"\b(?:v\d+\.\d+|version\s+\d+)", re.I),  # version references
    re.compile(r"\b\d+(?:\.\d+)?%"),              # percentages
    re.compile(r"\b(?:first|only|largest|fastest|most)\b", re.I),  # superlatives
]

# Sentences to skip — headings, code fences, links-only lines, badges, etc.
SKIP_PATTERNS = [
    re.compile(r"^#{1,6}\s"),                     # markdown headings
    re.compile(r"^```"),                           # code fences
    re.compile(r"^\s*[-*]\s*$"),                   # empty list items
    re.compile(r"^\s*\|"),                         # table rows
    re.compile(r"^\s*!\["),                        # images
    re.compile(r"^<"),                             # HTML tags
    re.compile(r"^\s*$"),                          # blank lines
]

MIN_CLAIM_LENGTH = 20
MAX_CLAIM_LENGTH = 300


def extract_text_from_html(html: str) -> str:
    """Strip HTML tags and return plain text, one sentence per line."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    # Remove script/style elements
    for tag in soup(["script", "style", "code", "pre"]):
        tag.decompose()
    return soup.get_text(separator="\n")


def extract_claims(text: str) -> list[str]:
    """Extract verifiable factual claims from document text.

    Splits text into sentences, then keeps only those matching
    at least one claim pattern (numbers, dates, comparisons, etc.).
    """
    # Normalize whitespace but keep line breaks
    lines = text.split("\n")
    claims: list[str] = []
    seen: set[str] = set()

    for line in lines:
        line = line.strip()

        # Skip non-content lines
        if any(p.match(line) for p in SKIP_PATTERNS):
            continue

        # Strip markdown formatting
        clean = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)  # [text](url) -> text
        clean = re.sub(r"[`*_~]", "", clean)                    # inline formatting
        clean = re.sub(r"^\s*[-*+]\s+", "", clean)              # list bullets
        clean = re.sub(r"^\s*\d+\.\s+", "", clean)              # numbered lists
        clean = clean.strip()

        if len(clean) < MIN_CLAIM_LENGTH or len(clean) > MAX_CLAIM_LENGTH:
            continue

        # Split on sentence boundaries for long lines
        sentences = re.split(r"(?<=[.!?])\s+", clean)
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < MIN_CLAIM_LENGTH:
                continue

            # Check if it matches any claim pattern
            if any(p.search(sentence) for p in CLAIM_PATTERNS):
                normalized = sentence.lower().strip()
                if normalized not in seen:
                    seen.add(normalized)
                    claims.append(sentence)

    return claims


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

@dataclass
class ClaimResult:
    """Result of verifying a single claim."""
    claim: str
    confidence: float = 0.0
    answer: str = ""
    sources: list[dict] = field(default_factory=list)
    contradictions: list[dict] = field(default_factory=list)
    flagged: bool = False
    flag_reason: str = ""
    error: str = ""


@dataclass
class VerificationReport:
    """Full verification report for a document."""
    source: str
    results: list[ClaimResult] = field(default_factory=list)
    total_claims: int = 0
    verified_count: int = 0
    flagged_count: int = 0
    error_count: int = 0
    elapsed_seconds: float = 0.0


CONFIDENCE_THRESHOLD = 0.50


def verify_claim(client: BrowseAIDev, claim: str, depth: str = "fast") -> ClaimResult:
    """Verify a single claim using BrowseAI's ask() endpoint."""
    result = ClaimResult(claim=claim)

    query = f'Is the following statement accurate and up-to-date? "{claim}"'

    try:
        response = client.ask(query, depth=depth)
        result.confidence = response.confidence
        result.answer = response.answer

        result.sources = [
            {"url": s.url, "title": s.title, "domain": s.domain}
            for s in response.sources
        ]

        if response.contradictions:
            result.contradictions = [
                {"claim_a": c.claim_a, "claim_b": c.claim_b, "topic": c.topic}
                for c in response.contradictions
            ]

        # Flag if low confidence or contradictions found
        if result.confidence < CONFIDENCE_THRESHOLD:
            result.flagged = True
            result.flag_reason = f"Low confidence ({result.confidence:.0%})"
        elif result.contradictions:
            result.flagged = True
            result.flag_reason = f"{len(result.contradictions)} contradiction(s) found"

    except Exception as e:
        result.error = str(e)
        result.flagged = True
        result.flag_reason = f"Verification error: {e}"

    return result


def fetch_document(client: BrowseAIDev, source: str) -> str:
    """Fetch document content from a URL or local file path."""
    parsed = urlparse(source)

    if parsed.scheme in ("http", "https"):
        console.print(f"[dim]Fetching remote document: {source}[/dim]")
        page = client.open(source)
        return page.content
    else:
        path = Path(source).expanduser().resolve()
        if not path.exists():
            console.print(f"[red]File not found: {path}[/red]")
            sys.exit(1)
        console.print(f"[dim]Reading local file: {path}[/dim]")
        text = path.read_text(encoding="utf-8")
        # If it's HTML, extract text
        if path.suffix.lower() in (".html", ".htm"):
            text = extract_text_from_html(text)
        return text


def run_verification(
    client: BrowseAIDev,
    source: str,
    depth: str = "fast",
    max_claims: int | None = None,
) -> VerificationReport:
    """Run the full verification pipeline on a document."""
    report = VerificationReport(source=source)
    start = time.time()

    # Step 1: Fetch the document
    text = fetch_document(client, source)
    if not text.strip():
        console.print("[red]Document is empty or could not be parsed.[/red]")
        sys.exit(1)

    # Step 2: Extract claims
    claims = extract_claims(text)
    if max_claims:
        claims = claims[:max_claims]
    report.total_claims = len(claims)

    if not claims:
        console.print("[yellow]No verifiable claims found in document.[/yellow]")
        return report

    console.print(f"\n[bold]Found {len(claims)} verifiable claim(s). Verifying...[/bold]\n")

    # Step 3: Verify each claim
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Verifying claims...", total=len(claims))
        for i, claim in enumerate(claims):
            progress.update(task, description=f"[{i + 1}/{len(claims)}] Verifying...")
            result = verify_claim(client, claim, depth=depth)
            report.results.append(result)

            if result.error:
                report.error_count += 1
            elif result.flagged:
                report.flagged_count += 1
            else:
                report.verified_count += 1

            progress.advance(task)

    report.elapsed_seconds = time.time() - start
    return report


# ---------------------------------------------------------------------------
# Output formatting
# ---------------------------------------------------------------------------

def status_icon(result: ClaimResult) -> str:
    if result.error:
        return "[yellow]ERR[/yellow]"
    if result.flagged:
        return "[red]FLAG[/red]"
    return "[green]OK[/green]"


def print_report(report: VerificationReport) -> None:
    """Print the verification report as a rich terminal table."""
    console.print()
    console.print(Panel(
        f"[bold]Documentation Verification Report[/bold]\n"
        f"Source: {report.source}\n"
        f"Time: {report.elapsed_seconds:.1f}s",
        border_style="blue",
    ))

    # Summary
    summary_table = Table(show_header=False, box=None, padding=(0, 2))
    summary_table.add_row("Total claims", str(report.total_claims))
    summary_table.add_row("[green]Verified[/green]", str(report.verified_count))
    summary_table.add_row("[red]Flagged[/red]", str(report.flagged_count))
    summary_table.add_row("[yellow]Errors[/yellow]", str(report.error_count))
    console.print(summary_table)
    console.print()

    # Detailed results
    table = Table(title="Claim Details", show_lines=True)
    table.add_column("#", style="dim", width=4)
    table.add_column("Status", width=6)
    table.add_column("Confidence", width=12)
    table.add_column("Claim", max_width=60)
    table.add_column("Notes", max_width=40)

    for i, r in enumerate(report.results, 1):
        conf_str = f"{r.confidence:.0%}" if not r.error else "N/A"
        conf_style = ""
        if not r.error:
            if r.confidence >= 0.7:
                conf_style = "green"
            elif r.confidence >= CONFIDENCE_THRESHOLD:
                conf_style = "yellow"
            else:
                conf_style = "red"

        notes = ""
        if r.error:
            notes = f"[yellow]{r.error[:60]}[/yellow]"
        elif r.flag_reason:
            notes = f"[red]{r.flag_reason}[/red]"
        elif r.sources:
            notes = f"{len(r.sources)} source(s)"

        table.add_row(
            str(i),
            status_icon(r),
            f"[{conf_style}]{conf_str}[/{conf_style}]" if conf_style else conf_str,
            r.claim[:80] + ("..." if len(r.claim) > 80 else ""),
            notes,
        )

    console.print(table)

    # Show flagged claims in detail
    flagged = [r for r in report.results if r.flagged]
    if flagged:
        console.print()
        console.print("[bold red]Flagged Claims (need attention):[/bold red]")
        for r in flagged:
            console.print()
            console.print(f"  [bold]Claim:[/bold] {r.claim}")
            console.print(f"  [bold]Reason:[/bold] {r.flag_reason}")
            if r.answer:
                # Truncate long answers
                answer_preview = r.answer[:200] + ("..." if len(r.answer) > 200 else "")
                console.print(f"  [bold]Finding:[/bold] {answer_preview}")
            if r.contradictions:
                for c in r.contradictions:
                    console.print(f"  [bold]Contradiction:[/bold] {c['claim_a']} vs {c['claim_b']}")
            if r.sources:
                for s in r.sources[:3]:
                    console.print(f"  [dim]Source: {s['title']} ({s['url']})[/dim]")


def export_markdown(report: VerificationReport, output_path: str) -> None:
    """Export the verification report as a markdown file."""
    lines: list[str] = []
    lines.append("# Documentation Verification Report\n")
    lines.append(f"**Source:** `{report.source}`  ")
    lines.append(f"**Time:** {report.elapsed_seconds:.1f}s\n")

    lines.append("## Summary\n")
    lines.append(f"| Metric | Count |")
    lines.append(f"|--------|-------|")
    lines.append(f"| Total claims | {report.total_claims} |")
    lines.append(f"| Verified | {report.verified_count} |")
    lines.append(f"| Flagged | {report.flagged_count} |")
    lines.append(f"| Errors | {report.error_count} |")
    lines.append("")

    lines.append("## Detailed Results\n")
    lines.append("| # | Status | Confidence | Claim | Notes |")
    lines.append("|---|--------|------------|-------|-------|")

    for i, r in enumerate(report.results, 1):
        status = "ERR" if r.error else ("FLAG" if r.flagged else "OK")
        conf = f"{r.confidence:.0%}" if not r.error else "N/A"
        claim_text = r.claim.replace("|", "\\|")[:80]
        notes = ""
        if r.error:
            notes = r.error[:40]
        elif r.flag_reason:
            notes = r.flag_reason
        elif r.sources:
            notes = f"{len(r.sources)} source(s)"
        lines.append(f"| {i} | {status} | {conf} | {claim_text} | {notes} |")

    lines.append("")

    # Flagged details
    flagged = [r for r in report.results if r.flagged]
    if flagged:
        lines.append("## Flagged Claims\n")
        for r in flagged:
            lines.append(f"### {r.claim[:80]}\n")
            lines.append(f"- **Reason:** {r.flag_reason}")
            if r.answer:
                lines.append(f"- **Finding:** {r.answer[:300]}")
            if r.contradictions:
                for c in r.contradictions:
                    lines.append(f"- **Contradiction:** {c['claim_a']} vs {c['claim_b']}")
            if r.sources:
                lines.append("- **Sources:**")
                for s in r.sources[:5]:
                    lines.append(f"  - [{s['title']}]({s['url']})")
            lines.append("")

    Path(output_path).write_text("\n".join(lines), encoding="utf-8")
    console.print(f"\n[green]Report exported to {output_path}[/green]")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Verify factual claims in documentation using BrowseAI.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python verify_docs.py https://raw.githubusercontent.com/BrowseAI-HQ/BrowseAI-Dev/main/README.md
  python verify_docs.py ./README.md --depth thorough
  python verify_docs.py ./docs/api.md --output report.md --max-claims 10
        """,
    )
    parser.add_argument("source", help="URL or local file path to the document")
    parser.add_argument(
        "--api-key",
        default=None,
        help="BrowseAI API key (or set BROWSEAI_API_KEY env var)",
    )
    parser.add_argument(
        "--depth",
        choices=["fast", "thorough"],
        default="fast",
        help="Verification depth: 'fast' (default) or 'thorough'",
    )
    parser.add_argument(
        "--max-claims",
        type=int,
        default=None,
        help="Maximum number of claims to verify (useful for large docs)",
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Export report as markdown file",
    )
    parser.add_argument(
        "--confidence-threshold",
        type=float,
        default=0.50,
        help="Flag claims below this confidence (default: 0.50)",
    )

    args = parser.parse_args()

    # Override global threshold
    global CONFIDENCE_THRESHOLD
    CONFIDENCE_THRESHOLD = args.confidence_threshold

    # Resolve API key
    import os
    api_key = args.api_key or os.environ.get("BROWSEAI_API_KEY")
    if not api_key:
        console.print("[red]Error: Provide --api-key or set BROWSEAI_API_KEY env var[/red]")
        sys.exit(1)

    console.print(Panel(
        "[bold blue]BrowseAI Docs Verifier[/bold blue]\n"
        "Extracts factual claims from documentation and verifies each one.",
        border_style="blue",
    ))

    client = BrowseAIDev(api_key=api_key)

    report = run_verification(
        client=client,
        source=args.source,
        depth=args.depth,
        max_claims=args.max_claims,
    )

    print_report(report)

    if args.output:
        export_markdown(report, args.output)

    # Exit with non-zero if any claims flagged
    if report.flagged_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
