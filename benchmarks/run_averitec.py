#!/usr/bin/env python3
"""
AVeriTeC Benchmark Runner for BrowseAI Dev

Evaluates BrowseAI Dev's verification pipeline against the AVeriTeC dataset.
Calls the local API for each claim and maps results to AVeriTeC's label format.

Usage:
    python benchmarks/run_averitec.py --split dev --limit 50
    python benchmarks/run_averitec.py --split test --depth thorough
    python benchmarks/run_averitec.py --split dev --evaluate-only

Requires:
    pip install requests datasets tqdm
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from datasets import load_dataset
from tqdm import tqdm


# --- Config ---
API_BASE = os.environ.get("BROWSE_API_URL", "http://localhost:3001")
API_KEY = os.environ.get("BROWSE_API_KEY", "")
RESULTS_DIR = Path(__file__).parent / "results"
DATA_DIR = Path(__file__).parent / "data"

# Label mapping thresholds (tuned on dev set)
CONFIDENCE_HIGH = 0.65
CONFIDENCE_LOW = 0.35


def map_to_averitec_label(result: dict) -> str:
    """Map BrowseAI Dev result to AVeriTeC's 4-label schema."""
    confidence = result.get("confidence", 0)
    claims = result.get("claims", [])
    contradictions = result.get("contradictions", [])

    verified_count = sum(1 for c in claims if c.get("verified"))
    total_claims = len(claims)
    verification_rate = verified_count / total_claims if total_claims > 0 else 0

    # Conflicting evidence: contradictions detected
    if contradictions and confidence >= CONFIDENCE_LOW:
        return "Conflicting Evidence/Cherry-picking"

    # Supported: high confidence + majority verified
    if confidence >= CONFIDENCE_HIGH and verification_rate >= 0.5:
        return "Supported"

    # Refuted: high confidence but low verification (claims don't match sources)
    if confidence >= CONFIDENCE_HIGH and verification_rate < 0.3:
        return "Refuted"

    # Not enough evidence
    if confidence < CONFIDENCE_LOW:
        return "Not Enough Evidence"

    # Mid-confidence: check verification rate
    if verification_rate >= 0.6:
        return "Supported"
    elif verification_rate < 0.3:
        return "Refuted"

    return "Not Enough Evidence"


def build_evidence(result: dict, claim_text: str) -> list[dict]:
    """Map BrowseAI Dev sources to AVeriTeC evidence format."""
    evidence = []
    sources = result.get("sources", [])

    for source in sources[:5]:  # Cap at 5 evidence items
        evidence.append({
            "question": f"Is the following claim true: {claim_text}",
            "answer": source.get("quote", result.get("answer", "")[:200]),
            "url": source.get("url", ""),
            "scraped_text": source.get("quote", ""),
        })

    # Ensure at least one evidence item
    if not evidence:
        evidence.append({
            "question": f"Is the following claim true: {claim_text}",
            "answer": result.get("answer", "No evidence found."),
            "url": "",
            "scraped_text": "",
        })

    return evidence


def query_browseai(claim: str, depth: str = "fast", retries: int = 2) -> dict | None:
    """Query BrowseAI Dev API for a claim."""
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"

    payload = {
        "query": f"Verify: {claim}",
        "depth": depth,
    }

    for attempt in range(retries + 1):
        try:
            resp = requests.post(
                f"{API_BASE}/api/answer",
                json=payload,
                headers=headers,
                timeout=60,
            )
            if resp.status_code == 429:
                wait = 2 ** attempt * 5
                time.sleep(wait)
                continue
            if resp.status_code == 200:
                data = resp.json()
                return data.get("result", data)
            else:
                return None
        except (requests.Timeout, requests.ConnectionError):
            if attempt < retries:
                time.sleep(2 ** attempt)
            continue

    return None


def run_benchmark(split: str, limit: int | None, depth: str, concurrency: int):
    """Run AVeriTeC benchmark on specified split."""
    print(f"Loading AVeriTeC {split} set...")
    ds = load_dataset("chenxwh/AVeriTeC", split=split)

    if limit:
        ds = ds.select(range(min(limit, len(ds))))

    print(f"Running {len(ds)} claims against {API_BASE} (depth={depth}, concurrency={concurrency})")

    predictions = []
    stats = {"supported": 0, "refuted": 0, "conflicting": 0, "nei": 0, "failed": 0}

    def process_claim(idx, item):
        claim_text = item["claim"]
        result = query_browseai(claim_text, depth=depth)

        if result is None:
            return idx, None

        pred_label = map_to_averitec_label(result)
        evidence = build_evidence(result, claim_text)

        return idx, {
            "claim_id": idx,
            "claim": claim_text,
            "pred_label": pred_label,
            "evidence": evidence,
            "confidence": result.get("confidence", 0),
            "verification_rate": (
                sum(1 for c in result.get("claims", []) if c.get("verified"))
                / max(len(result.get("claims", [])), 1)
            ),
            "gold_label": item.get("label", ""),
        }

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = {
            executor.submit(process_claim, i, ds[i]): i
            for i in range(len(ds))
        }

        for future in tqdm(as_completed(futures), total=len(ds), desc="Evaluating"):
            idx, pred = future.result()
            if pred is None:
                stats["failed"] += 1
                continue

            predictions.append(pred)
            label_key = {
                "Supported": "supported",
                "Refuted": "refuted",
                "Conflicting Evidence/Cherry-picking": "conflicting",
                "Not Enough Evidence": "nei",
            }.get(pred["pred_label"], "nei")
            stats[label_key] += 1

    # Sort by claim_id
    predictions.sort(key=lambda x: x["claim_id"])

    # Save results
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out_file = RESULTS_DIR / f"averitec_{split}_{depth}_{len(predictions)}.json"
    with open(out_file, "w") as f:
        json.dump(predictions, f, indent=2)

    print(f"\nResults saved to {out_file}")
    print(f"\nPrediction distribution:")
    print(f"  Supported: {stats['supported']}")
    print(f"  Refuted: {stats['refuted']}")
    print(f"  Conflicting: {stats['conflicting']}")
    print(f"  Not Enough Evidence: {stats['nei']}")
    print(f"  Failed: {stats['failed']}")

    return predictions


def evaluate(predictions: list[dict]):
    """Compute accuracy metrics against gold labels."""
    if not predictions or not predictions[0].get("gold_label"):
        print("No gold labels available for evaluation.")
        return

    correct = 0
    total = 0
    per_label = {}

    for pred in predictions:
        gold = pred.get("gold_label", "")
        predicted = pred.get("pred_label", "")
        if not gold:
            continue

        total += 1
        if gold == predicted:
            correct += 1

        if gold not in per_label:
            per_label[gold] = {"correct": 0, "total": 0}
        per_label[gold]["total"] += 1
        if gold == predicted:
            per_label[gold]["correct"] += 1

    accuracy = correct / total if total > 0 else 0
    print(f"\n{'='*50}")
    print(f"AVeriTeC Verdict Accuracy: {accuracy:.1%} ({correct}/{total})")
    print(f"{'='*50}")

    print("\nPer-label accuracy:")
    for label, counts in sorted(per_label.items()):
        acc = counts["correct"] / counts["total"] if counts["total"] > 0 else 0
        print(f"  {label}: {acc:.1%} ({counts['correct']}/{counts['total']})")

    # Confidence calibration
    bins = [(0, 0.3), (0.3, 0.5), (0.5, 0.7), (0.7, 0.85), (0.85, 1.0)]
    print("\nConfidence calibration:")
    for lo, hi in bins:
        in_bin = [p for p in predictions if lo <= p.get("confidence", 0) < hi]
        if not in_bin:
            continue
        bin_correct = sum(1 for p in in_bin if p["gold_label"] == p["pred_label"])
        bin_acc = bin_correct / len(in_bin)
        print(f"  [{lo:.2f}-{hi:.2f}): accuracy={bin_acc:.1%} (n={len(in_bin)})")


def main():
    parser = argparse.ArgumentParser(description="AVeriTeC Benchmark Runner for BrowseAI Dev")
    parser.add_argument("--split", default="dev", choices=["train", "dev", "test"],
                        help="Dataset split to evaluate (default: dev)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Limit number of claims to process")
    parser.add_argument("--depth", default="fast", choices=["fast", "thorough"],
                        help="BrowseAI Dev depth mode (default: fast)")
    parser.add_argument("--concurrency", type=int, default=3,
                        help="Number of concurrent API requests (default: 3)")
    parser.add_argument("--evaluate-only", type=str, default=None,
                        help="Path to existing results file to evaluate")

    args = parser.parse_args()

    if args.evaluate_only:
        with open(args.evaluate_only) as f:
            predictions = json.load(f)
        evaluate(predictions)
        return

    predictions = run_benchmark(args.split, args.limit, args.depth, args.concurrency)
    evaluate(predictions)


if __name__ == "__main__":
    main()
