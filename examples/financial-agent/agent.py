"""
Financial Agent — BrowseAI Dev Example

Verifies financial data and market claims with evidence-backed citations.
Uses thorough mode to cross-check revenue figures, delivery numbers, and
market data against multiple financial sources.

Usage:
    pip install browseaidev
    BROWSEAI_API_KEY=bai_xxx python agent.py
    BROWSEAI_API_KEY=bai_xxx python agent.py "Tesla revenue and delivery numbers 2025"
"""

import os
import sys
from browseaidev import BrowseAIDev


def verify_financial_data(query: str):
    api_key = os.environ.get("BROWSEAI_API_KEY", "bai_xxx")
    client = BrowseAIDev(api_key=api_key)

    print(f"\nFinancial Research: {query}\n")
    print("Running thorough verification (cross-checking financial sources)...\n")

    # Thorough mode cross-checks financial figures across multiple sources.
    # Financial data is time-sensitive — BrowseAI's real-time search ensures
    # you get the latest numbers, not stale training data.
    result = client.ask(query, depth="thorough")

    # Answer
    print(f"Answer:\n{result.answer}\n")
    print(f"Confidence: {result.confidence:.0%}")

    # Claims breakdown
    verified = [c for c in result.claims if c.verified]
    unverified = [c for c in result.claims if not c.verified]
    print(f"Claims: {len(verified)} verified, {len(unverified)} unverified out of {len(result.claims)} total\n")

    # Verified financial claims — numbers you can cite
    if verified:
        print("Verified Financial Claims:")
        for c in verified:
            consensus = c.consensus_level or "unknown"
            print(f"  [verified] {c.claim}")
            print(f"    Consensus: {consensus} | Sources: {len(c.sources)}")
        print()

    # Unverified claims — do not cite without manual verification
    if unverified:
        print("Unverified Claims (do not cite without manual check):")
        for c in unverified:
            print(f"  [unverified] {c.claim}")
        print()

    # Contradictions — common in financial reporting (different quarters, adjusted vs GAAP)
    if result.contradictions:
        print(f"Contradictions Detected ({len(result.contradictions)}):")
        for c in result.contradictions:
            print(f"  Topic: {c.topic}")
            print(f"    Source A says: {c.claim_a}")
            print(f"    Source B says: {c.claim_b}")
        print()
        print("  Note: Financial contradictions often arise from different reporting")
        print("  periods, GAAP vs non-GAAP figures, or preliminary vs final numbers.\n")
    else:
        print("No contradictions detected between sources.\n")

    # Sources ranked by authority — financial data needs authoritative sources
    print(f"Sources ({len(result.sources)}):")
    for s in sorted(result.sources, key=lambda x: x.authority or 0, reverse=True):
        authority = f"authority: {s.authority:.2f}" if s.authority else "no authority score"
        verified_tag = "verified" if s.verified else "unverified"
        print(f"  [{verified_tag}] [{authority}] {s.domain}: {s.title}")
        print(f"    {s.url}")


if __name__ == "__main__":
    query = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "Tesla revenue and delivery numbers 2025"
    )
    verify_financial_data(query)
