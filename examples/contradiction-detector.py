"""
Contradiction Detector — BrowseAI Example

Research a controversial topic and surface contradictions found
across different sources. Uses thorough mode for deeper verification.

Usage:
    pip install browseai
    python contradiction-detector.py "Is coffee good for your health?"
"""

import os
import sys
from browseai import BrowseAI


def detect_contradictions(query: str):
    api_key = os.environ.get("BROWSEAI_API_KEY", "bai_xxx")
    client = BrowseAI(api_key=api_key)

    print(f"\nSearching for contradictions: {query}\n")

    # Thorough mode checks multiple passes for consistency
    result = client.ask(query, depth="thorough")

    print(f"Answer:\n{result.answer}\n")
    print(f"Confidence: {result.confidence:.0%}")

    # Check for contradictions
    if result.contradictions:
        print(f"\n{'='*60}")
        print(f"CONTRADICTIONS FOUND: {len(result.contradictions)}")
        print(f"{'='*60}")
        for i, c in enumerate(result.contradictions, 1):
            print(f"\n  {i}. Topic: {c.topic}")
            print(f"     Claim A: {c.claim_a}")
            print(f"     Claim B: {c.claim_b}")
            if hasattr(c, "nli_confidence") and c.nli_confidence:
                print(f"     NLI Confidence: {c.nli_confidence:.0%}")
    else:
        print("\nNo contradictions detected across sources.")

    # Show consensus levels for each claim
    print(f"\nClaim Analysis ({len(result.claims)} claims):")
    for i, claim in enumerate(result.claims, 1):
        status = "VERIFIED" if claim.verified else "UNVERIFIED"
        consensus = claim.consensus_level or "unknown"
        score = f"{claim.verification_score:.2f}" if claim.verification_score else "N/A"
        sources_count = len(claim.sources)

        # Flag weak claims
        flag = ""
        if consensus == "weak" or sources_count <= 1:
            flag = " [WEAK - single source]"
        elif consensus == "strong":
            flag = " [STRONG consensus]"

        print(f"  {i}. [{status}] {claim.claim}")
        print(f"     Score: {score} | Consensus: {consensus} | Sources: {sources_count}{flag}")

    # Show domain diversity
    domains = {s.domain for s in result.sources}
    print(f"\nSource diversity: {len(domains)} unique domains from {len(result.sources)} sources")
    for s in result.sources:
        authority = f"authority={s.authority:.2f}" if s.authority else ""
        print(f"  - {s.domain} {authority}")


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "Is coffee good for your health?"
    detect_contradictions(query)
