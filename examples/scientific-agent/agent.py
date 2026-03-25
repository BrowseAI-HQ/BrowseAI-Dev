"""
Scientific Agent — BrowseAI Dev Example

Cross-checks research findings and detects contradictions in scientific
literature. Uses deep mode for iterative gap analysis with follow-up
searches, ideal for complex topics where consensus is evolving.

Usage:
    pip install browseaidev
    BROWSEAI_API_KEY=bai_xxx python agent.py
    BROWSEAI_API_KEY=bai_xxx python agent.py "Current consensus on dark matter vs modified gravity"
"""

import os
import sys
from browseaidev import BrowseAIDev


def research_scientific_topic(query: str):
    api_key = os.environ.get("BROWSEAI_API_KEY", "bai_xxx")
    client = BrowseAIDev(api_key=api_key)

    print(f"\nScientific Research: {query}\n")
    print("Running deep research (iterative gap analysis with follow-up searches)...\n")

    # Deep mode: iterative research with gap analysis and follow-up queries.
    # Runs up to 3 research passes, identifying knowledge gaps after each pass
    # and generating targeted follow-up searches. Ideal for complex scientific
    # topics where a single search pass is insufficient.
    result = client.ask(query, depth="deep")

    # Show reasoning steps — each step is a research iteration
    if result.reasoning_steps:
        print(f"Research Iterations ({len(result.reasoning_steps)}):")
        for step in result.reasoning_steps:
            marker = "*" if step.confidence >= 0.75 else "-"
            print(f"  {marker} Step {step.step}: \"{step.query}\"")
            print(f"    Claims: {step.claim_count} | Confidence: {step.confidence:.0%}")
            if step.gap_analysis and step.gap_analysis != "Initial research pass":
                print(f"    Gap identified: {step.gap_analysis}")
        print()

    # Answer
    print(f"Answer:\n{result.answer}\n")
    print(f"Overall Confidence: {result.confidence:.0%}")

    # Claims with consensus levels — key for scientific topics
    verified = [c for c in result.claims if c.verified]
    unverified = [c for c in result.claims if not c.verified]
    print(f"Claims: {len(verified)} verified, {len(unverified)} unverified out of {len(result.claims)} total\n")

    # Strong consensus claims — well-established findings
    strong = [c for c in result.claims if c.consensus_level == "strong"]
    if strong:
        print(f"Strong Consensus ({len(strong)}):")
        for c in strong:
            print(f"  - {c.claim}")
            print(f"    Sources: {len(c.sources)} | Score: {c.verification_score:.2f}")
        print()

    # Weak consensus — emerging or disputed findings
    weak = [c for c in result.claims if c.consensus_level in ("weak", "none")]
    if weak:
        print(f"Weak/No Consensus ({len(weak)}):")
        for c in weak:
            consensus = c.consensus_level or "unknown"
            print(f"  - {c.claim}")
            print(f"    Consensus: {consensus} | Sources: {len(c.sources)}")
        print()

    # Contradictions — the heart of scientific debate
    if result.contradictions:
        print(f"Contradictions Detected ({len(result.contradictions)}):")
        for c in result.contradictions:
            print(f"  Topic: {c.topic}")
            print(f"    Finding A: {c.claim_a}")
            print(f"    Finding B: {c.claim_b}")
            if hasattr(c, "nli_confidence") and c.nli_confidence:
                print(f"    Semantic confidence: {c.nli_confidence:.0%}")
            print()
    else:
        print("No contradictions detected between sources.\n")

    # Sources with authority scores
    print(f"Sources ({len(result.sources)}):")
    for s in sorted(result.sources, key=lambda x: x.authority or 0, reverse=True):
        authority = f"authority: {s.authority:.2f}" if s.authority else "no authority score"
        print(f"  [{authority}] {s.domain}: {s.title}")
        print(f"    {s.url}")


if __name__ == "__main__":
    query = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "Current consensus on dark matter vs modified gravity"
    )
    research_scientific_topic(query)
