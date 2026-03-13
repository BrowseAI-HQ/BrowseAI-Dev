"""
Hallucination Detector — BrowseAI Dev Example

Compare what a raw LLM says vs what evidence-backed research says.
See the difference between hallucinated answers and verified ones.

Usage:
    pip install browseai
    python hallucination-detector.py "Did India win the 2026 T20 World Cup?"
"""

import sys
from browseai import BrowseAI


def detect_hallucination(query: str):
    client = BrowseAI(api_key="bai_xxx")

    print(f"\n--- Hallucination Detector ---")
    print(f"Query: {query}\n")

    # Compare raw LLM vs evidence-backed answer
    result = client.compare(query)

    print("=" * 60)
    print("RAW LLM (no sources, may hallucinate):")
    print("=" * 60)
    print(result.raw_llm.answer)
    print(f"Sources: {result.raw_llm.sources} | Claims: {result.raw_llm.claims}")
    print()

    print("=" * 60)
    print("EVIDENCE-BACKED (verified with real sources):")
    print("=" * 60)
    print(result.evidence_backed.answer)
    print()

    print(f"Confidence: {result.evidence_backed.confidence:.0%}")
    print(f"Sources used: {result.evidence_backed.sources}")
    print(f"Claims verified: {result.evidence_backed.claims}")
    print()

    if result.evidence_backed.citations:
        print("Evidence:")
        for source in result.evidence_backed.citations:
            print(f"  [{source.domain}] {source.title}")
            print(f"    {source.url}")
            print()


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "What company is worth the most in 2025?"
    detect_hallucination(query)
