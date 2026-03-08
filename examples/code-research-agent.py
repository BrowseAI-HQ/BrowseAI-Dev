"""
Code Research Agent — BrowseAI Example

An agent that researches libraries, frameworks, and technical topics
before writing code. Perfect for AI coding assistants that need
to verify docs and APIs before generating code.

Usage:
    pip install browseai
    python code-research-agent.py "best Python async HTTP libraries"
"""

import sys
from browseai import BrowseAI


def code_research(query: str):
    client = BrowseAI(api_key="bai_xxx")

    print(f"\n--- Code Research Agent ---")
    print(f"Query: {query}\n")

    # Step 1: Search for relevant resources
    print("Step 1: Searching the web...")
    search_results = client.search(query, limit=5)

    print(f"Found {len(search_results)} results:")
    for r in search_results:
        print(f"  - {r.title} ({r.url})")
    print()

    # Step 2: Extract structured info from the top result
    if search_results:
        top_url = search_results[0].url
        print(f"Step 2: Extracting from {top_url}...")
        extracted = client.extract(top_url, query=query)

        print(f"Confidence: {extracted.confidence:.0%}")
        print(f"Claims found: {len(extracted.claims)}\n")

        for claim in extracted.claims:
            print(f"  - {claim.claim}")
        print()

    # Step 3: Get a full evidence-backed answer
    print("Step 3: Building evidence-backed answer...")
    result = client.ask(query)

    print(f"\nAnswer:\n{result.answer}\n")
    print(f"Confidence: {result.confidence:.0%}")
    print(f"Sources: {len(result.sources)}")
    print(f"Verified claims: {len(result.claims)}")


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "best Python async HTTP libraries in 2025"
    code_research(query)
