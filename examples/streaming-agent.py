"""
Streaming Research Agent — BrowseAI Example

Real-time progress tracking via Server-Sent Events (SSE).
Shows pipeline steps, discovered sources, and answer tokens
as they arrive — ideal for building responsive UIs.

Usage:
    pip install browseaidev httpx
    python streaming-agent.py "What are the latest breakthroughs in fusion energy?"
"""

import json
import sys
import httpx


API_URL = "https://browseai.dev/api/browse/answer/stream"


def stream_research(query: str, depth: str = "fast"):
    """Stream a research query and print events as they arrive."""

    print(f"\nStreaming ({depth}): {query}\n")

    headers = {
        "Content-Type": "application/json",
        "X-API-Key": "bai_xxx",
    }

    answer_tokens = []
    current_event = ""

    with httpx.stream(
        "POST",
        API_URL,
        json={"query": query, "depth": depth},
        headers=headers,
        timeout=120.0,
    ) as response:
        for line in response.iter_lines():
            if line.startswith("event: "):
                current_event = line[7:].strip()
            elif line.startswith("data: ") and current_event:
                try:
                    data = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue

                if current_event == "trace":
                    # Pipeline progress — each step of the verification pipeline
                    step = data.get("step", "")
                    duration = data.get("duration_ms", 0)
                    detail = data.get("detail", "")
                    if duration > 0:
                        print(f"  [done] {step} ({duration}ms) {detail}")
                    else:
                        print(f"  [....] {step}...")

                elif current_event == "sources":
                    # Early source discovery — before full extraction
                    print(f"\n  Discovered {len(data)} sources:")
                    for src in data[:5]:
                        print(f"    - {src.get('title', src.get('url', ''))}")

                elif current_event == "token":
                    # Streamed answer text — print character by character
                    token = data.get("token", "")
                    answer_tokens.append(token)
                    print(token, end="", flush=True)

                elif current_event == "reasoning_step":
                    # Deep mode only — reasoning step progress
                    step_num = data.get("step", 0)
                    step_query = data.get("query", "")
                    confidence = data.get("confidence", 0)
                    gap = data.get("gapAnalysis", "")
                    print(f"\n  Reasoning step {step_num}: \"{step_query}\"")
                    print(f"    Confidence: {confidence:.0%} | Gap: {gap}")

                elif current_event == "result":
                    # Final complete result
                    confidence = data.get("confidence", 0)
                    claims = data.get("claims", [])
                    sources = data.get("sources", [])
                    contradictions = data.get("contradictions", [])
                    print(f"\n\nConfidence: {confidence:.0%}")
                    print(f"Claims: {len(claims)} | Sources: {len(sources)}")
                    if contradictions:
                        print(f"Contradictions: {len(contradictions)}")

                elif current_event == "done":
                    quota = data.get("quota") if data else None
                    if quota:
                        print(f"Quota: {quota['used']}/{quota['limit']} "
                              f"({'premium' if quota['premiumActive'] else 'standard'})")
                    print("\nDone.")

                elif current_event == "error":
                    print(f"\nError: {data.get('error', 'Unknown error')}")
                    return

                current_event = ""


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "What are the latest breakthroughs in fusion energy?"
    depth = sys.argv[2] if len(sys.argv) > 2 else "fast"
    stream_research(query, depth)
