"""
Deep Research Agent — BrowseAI Example

Multi-step agentic reasoning that iteratively searches, identifies knowledge
gaps, and follows up until confidence is high. Shows reasoning steps,
contradictions, and verified claims.

Usage:
    pip install browseaidev
    BROWSEAI_API_KEY=bai_xxx python deep-research-agent.py "Compare CRISPR approaches for sickle cell disease"
"""

import os
import sys
from browseaidev import BrowseAIDev


def deep_research(query: str):
    api_key = os.environ.get("BROWSEAI_API_KEY", "bai_xxx")
    client = BrowseAIDev(api_key=api_key)

    print(f"\nDeep researching: {query}\n")

    # Deep mode: iterative gap analysis, follow-up searches, knowledge merging
    # Runs up to 3 research steps, stops early if confidence is high
    result = client.ask(query, depth="deep")

    # Show reasoning steps — each step is a research iteration
    if result.reasoning_steps:
        print(f"Reasoning Steps ({len(result.reasoning_steps)}):")
        for step in result.reasoning_steps:
            marker = "  *" if step.confidence >= 0.75 else "  -"
            print(f"{marker} Step {step.step}: \"{step.query}\"")
            print(f"    Claims: {step.claim_count} | Confidence: {step.confidence:.0%}")
            if step.gap_analysis and step.gap_analysis != "Initial research pass":
                print(f"    Gap: {step.gap_analysis}")
        print()

    # Show the answer
    print(f"Answer:\n{result.answer}\n")
    print(f"Overall Confidence: {result.confidence:.0%}")

    # Show contradictions if any were detected
    if result.contradictions:
        print(f"\nContradictions Detected ({len(result.contradictions)}):")
        for c in result.contradictions:
            print(f"  Topic: {c.topic}")
            print(f"    A: {c.claim_a}")
            print(f"    B: {c.claim_b}")
            if hasattr(c, "nli_confidence") and c.nli_confidence:
                print(f"    Semantic confidence: {c.nli_confidence:.0%}")
            print()

    # Show verified vs unverified claims
    verified = [c for c in result.claims if c.verified]
    unverified = [c for c in result.claims if not c.verified]
    print(f"\nClaims: {len(verified)} verified, {len(unverified)} unverified")

    # Show claims with consensus levels
    strong = [c for c in result.claims if c.consensus_level == "strong"]
    if strong:
        print(f"\nStrong Consensus Claims ({len(strong)}):")
        for c in strong:
            print(f"  - {c.claim}")
            print(f"    Sources: {len(c.sources)} | Score: {c.verification_score:.2f}")

    # Show sources with authority scores
    print(f"\nSources ({len(result.sources)}):")
    for s in sorted(result.sources, key=lambda x: x.authority or 0, reverse=True):
        authority = f"authority: {s.authority:.2f}" if s.authority else "no authority"
        verified_tag = "verified" if s.verified else "unverified"
        print(f"  [{verified_tag}] [{authority}] {s.domain}: {s.title}")

    # Show execution trace
    if result.trace:
        total_ms = sum(t.duration_ms for t in result.trace if t.duration_ms)
        print(f"\nExecution: {len(result.trace)} steps, {total_ms/1000:.1f}s total")


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "Compare CRISPR approaches for sickle cell disease"
    deep_research(query)
