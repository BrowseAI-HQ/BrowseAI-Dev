"""
Research Session Agent — BrowseAI Example

Build persistent knowledge across multiple queries. Each question
recalls prior findings and stores new verified claims — giving your
agent memory that compounds over time.

Usage:
    pip install browseaidev
    python research-session.py "quantum computing"
"""

import sys
from browseaidev import BrowseAIDev


def research_session(topic: str):
    client = BrowseAIDev(api_key="bai_xxx")

    # Create a named session
    session = client.session(f"{topic}-research")
    print(f"\nSession: {session.name} (id: {session.id})\n")

    # Define a series of questions that build on each other
    questions = [
        f"What is {topic}?",
        f"What are the main applications of {topic}?",
        f"What are the current challenges in {topic}?",
    ]

    for i, query in enumerate(questions, 1):
        print(f"--- Query {i}/{len(questions)} ---")
        print(f"Q: {query}\n")

        result = session.ask(query)

        print(f"A: {result.answer[:300]}...\n")
        print(f"Confidence: {result.confidence:.0%}")
        print(f"Recalled claims: {result.session.recalled_claims}")
        print(f"New claims stored: {result.session.new_claims_stored}")
        print(f"Sources: {len(result.sources)}")
        print()

    # Export all accumulated knowledge
    print("=== Session Knowledge ===\n")
    knowledge = session.knowledge()
    for entry in knowledge.entries:
        verified = "V" if entry.verified else " "
        print(f"  [{verified}] {entry.claim}")
        print(f"      from: \"{entry.origin_query}\" | {len(entry.sources)} source(s)")
        print()

    print(f"Total claims: {knowledge.count}")


if __name__ == "__main__":
    topic = sys.argv[1] if len(sys.argv) > 1 else "quantum computing"
    research_session(topic)
