"""
Education Agent — BrowseAI Dev Example

A research assistant for students and researchers. Uses deep mode to
explore complex questions with iterative gap analysis, providing
evidence-backed answers with full citations for academic use.

Usage:
    pip install browseaidev
    BROWSEAI_API_KEY=bai_xxx python agent.py
    BROWSEAI_API_KEY=bai_xxx python agent.py "What was before the Big Bang?"
"""

import os
import sys
from browseaidev import BrowseAIDev


def research_question(query: str):
    api_key = os.environ.get("BROWSEAI_API_KEY", "bai_xxx")
    client = BrowseAIDev(api_key=api_key)

    print(f"\nResearch Question: {query}\n")
    print("Running deep research (multi-step with gap analysis)...\n")

    # Deep mode: perfect for academic research where a single search pass
    # often misses important perspectives. Runs iterative gap analysis,
    # identifies missing angles, and runs follow-up searches automatically.
    result = client.ask(query, depth="deep")

    # Show reasoning steps — useful for students to see how research unfolds
    if result.reasoning_steps:
        print(f"Research Process ({len(result.reasoning_steps)} steps):")
        for step in result.reasoning_steps:
            marker = "*" if step.confidence >= 0.75 else "-"
            print(f"  {marker} Step {step.step}: \"{step.query}\"")
            print(f"    Found {step.claim_count} claims | Confidence: {step.confidence:.0%}")
            if step.gap_analysis and step.gap_analysis != "Initial research pass":
                print(f"    Knowledge gap: {step.gap_analysis}")
        print()

    # Answer
    print(f"Answer:\n{result.answer}\n")
    print(f"Confidence: {result.confidence:.0%}")

    # Claims breakdown
    verified = [c for c in result.claims if c.verified]
    unverified = [c for c in result.claims if not c.verified]
    print(f"Claims: {len(verified)} verified, {len(unverified)} unverified out of {len(result.claims)} total\n")

    # Show all claims with their verification status — helps students
    # understand which facts are well-supported and which need more research
    if result.claims:
        print("All Claims:")
        for i, c in enumerate(result.claims, 1):
            status = "verified" if c.verified else "unverified"
            consensus = c.consensus_level or "unknown"
            print(f"  {i}. [{status}] {c.claim}")
            print(f"     Consensus: {consensus} | Sources: {len(c.sources)}")
        print()

    # Contradictions — teaches critical thinking about conflicting sources
    if result.contradictions:
        print(f"Contradictions Found ({len(result.contradictions)}):")
        print("(Different sources disagree on these points)\n")
        for c in result.contradictions:
            print(f"  Topic: {c.topic}")
            print(f"    View A: {c.claim_a}")
            print(f"    View B: {c.claim_b}")
            print()
    else:
        print("No contradictions detected between sources.\n")

    # Sources — formatted for citation
    print(f"Sources ({len(result.sources)}):")
    for i, s in enumerate(result.sources, 1):
        authority = f"authority: {s.authority:.2f}" if s.authority else "no authority score"
        print(f"  {i}. [{authority}] {s.title}")
        print(f"     {s.domain} | {s.url}")
        if s.quote:
            print(f'     Quote: "{s.quote[:150]}..."')
        print()


if __name__ == "__main__":
    query = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "What was before the Big Bang?"
    )
    research_question(query)
