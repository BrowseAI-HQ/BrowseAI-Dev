"""
Legal Agent — BrowseAI Dev Example

Cross-references legal and regulatory claims against current sources.
Uses thorough mode to verify compliance requirements, legal precedents,
and regulatory frameworks with evidence-backed citations.

Usage:
    pip install browseaidev
    BROWSEAI_API_KEY=bai_xxx python agent.py
    BROWSEAI_API_KEY=bai_xxx python agent.py "GDPR requirements for AI-generated content"
"""

import os
import sys
from browseaidev import BrowseAIDev


def research_legal_query(query: str):
    api_key = os.environ.get("BROWSEAI_API_KEY", "bai_xxx")
    client = BrowseAIDev(api_key=api_key)

    print(f"\nLegal Research: {query}\n")
    print("Running thorough verification (cross-referencing regulatory sources)...\n")

    # Thorough mode ensures legal claims are cross-checked across
    # multiple authoritative sources — critical for compliance work.
    result = client.ask(query, depth="thorough")

    # Answer
    print(f"Answer:\n{result.answer}\n")
    print(f"Confidence: {result.confidence:.0%}")

    # Claims breakdown
    verified = [c for c in result.claims if c.verified]
    unverified = [c for c in result.claims if not c.verified]
    print(f"Claims: {len(verified)} verified, {len(unverified)} unverified out of {len(result.claims)} total\n")

    # Show verified legal claims with consensus
    if verified:
        print("Verified Legal Claims:")
        for c in verified:
            consensus = c.consensus_level or "unknown"
            score = f"{c.verification_score:.2f}" if c.verification_score else "N/A"
            print(f"  [verified] {c.claim}")
            print(f"    Consensus: {consensus} | Score: {score} | Sources: {len(c.sources)}")
        print()

    # Unverified claims need manual legal review
    if unverified:
        print("Unverified Claims (requires manual legal review):")
        for c in unverified:
            print(f"  [unverified] {c.claim}")
        print()

    # Contradictions — important for evolving regulatory landscapes
    if result.contradictions:
        print(f"Contradictions Detected ({len(result.contradictions)}):")
        for c in result.contradictions:
            print(f"  Topic: {c.topic}")
            print(f"    Position A: {c.claim_a}")
            print(f"    Position B: {c.claim_b}")
        print()
    else:
        print("No contradictions detected.\n")

    # Sources ranked by authority
    print(f"Sources ({len(result.sources)}):")
    for s in sorted(result.sources, key=lambda x: x.authority or 0, reverse=True):
        authority = f"authority: {s.authority:.2f}" if s.authority else "no authority score"
        print(f"  [{authority}] {s.domain}: {s.title}")
        print(f"    {s.url}")


if __name__ == "__main__":
    query = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "GDPR requirements for AI-generated content"
    )
    research_legal_query(query)
