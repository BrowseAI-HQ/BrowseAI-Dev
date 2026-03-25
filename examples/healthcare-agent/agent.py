"""
Healthcare Agent — BrowseAI Dev Example

Verifies medical claims using evidence-backed research with contradiction
detection. Uses thorough mode to cross-check findings across multiple
medical sources, ensuring claims are supported by current evidence.

Usage:
    pip install browseaidev
    BROWSEAI_API_KEY=bai_xxx python agent.py
    BROWSEAI_API_KEY=bai_xxx python agent.py "Is intermittent fasting safe for diabetics?"
"""

import os
import sys
from browseaidev import BrowseAIDev


def verify_medical_claim(query: str):
    api_key = os.environ.get("BROWSEAI_API_KEY", "bai_xxx")
    client = BrowseAIDev(api_key=api_key)

    print(f"\nHealthcare Research: {query}\n")
    print("Running thorough verification (cross-checking multiple sources)...\n")

    # Thorough mode: iterative confidence-gated loop with per-claim
    # evidence retrieval and counter-query adversarial verification.
    # Critical for medical claims where accuracy matters.
    result = client.ask(query, depth="thorough")

    # Answer
    print(f"Answer:\n{result.answer}\n")
    print(f"Confidence: {result.confidence:.0%}")

    # Verified claims — important for medical accuracy
    verified = [c for c in result.claims if c.verified]
    unverified = [c for c in result.claims if not c.verified]
    print(f"Claims: {len(verified)} verified, {len(unverified)} unverified out of {len(result.claims)} total\n")

    if verified:
        print("Verified Claims:")
        for c in verified:
            consensus = c.consensus_level or "unknown"
            print(f"  [verified] {c.claim}")
            print(f"    Consensus: {consensus} | Sources: {len(c.sources)}")
        print()

    if unverified:
        print("Unverified Claims (treat with caution):")
        for c in unverified:
            print(f"  [unverified] {c.claim}")
        print()

    # Contradictions — critical in healthcare where studies may disagree
    if result.contradictions:
        print(f"Contradictions Detected ({len(result.contradictions)}):")
        for c in result.contradictions:
            print(f"  Topic: {c.topic}")
            print(f"    Study A says: {c.claim_a}")
            print(f"    Study B says: {c.claim_b}")
            if hasattr(c, "nli_confidence") and c.nli_confidence:
                print(f"    Semantic confidence: {c.nli_confidence:.0%}")
            print()
    else:
        print("No contradictions detected between sources.\n")

    # Sources — show domain authority for medical credibility
    print(f"Sources ({len(result.sources)}):")
    for s in sorted(result.sources, key=lambda x: x.authority or 0, reverse=True):
        authority = f"authority: {s.authority:.2f}" if s.authority else "no authority score"
        print(f"  [{authority}] {s.domain}: {s.title}")
        print(f"    {s.url}")


if __name__ == "__main__":
    query = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "Is intermittent fasting safe for diabetics?"
    )
    verify_medical_claim(query)
