#!/usr/bin/env python3
"""
CLIMATE-FEVER Benchmark Runner for BrowseAI Dev

Evaluates BrowseAI Dev against CLIMATE-FEVER (1,535 climate claims).
Low baselines (38.78% accuracy) make this an easy win for marketing.

Usage:
    python benchmarks/run_climate_fever.py --limit 50
    python benchmarks/run_climate_fever.py --depth thorough
    python benchmarks/run_climate_fever.py --evaluate-only results/climate_fever_fast_100.json

Requires:
    pip install requests datasets tqdm scikit-learn
"""

import argparse
import json
import os
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from datasets import load_dataset
from tqdm import tqdm


API_BASE = os.environ.get("BROWSE_API_URL", "http://localhost:3001")
API_KEY = os.environ.get("BROWSE_API_KEY", "")
RESULTS_DIR = Path(__file__).parent / "results"

# CLIMATE-FEVER labels: SUPPORTS (0), REFUTES (1), NOT_ENOUGH_INFO (2)
LABEL_MAP = {0: "SUPPORTS", 1: "REFUTES", 2: "NOT_ENOUGH_INFO"}

# Confidence thresholds for label mapping
CONFIDENCE_HIGH = 0.65
CONFIDENCE_LOW = 0.35


def map_to_fever_label(result: dict) -> str:
    """Map BrowseAI Dev result to FEVER tri-label."""
    confidence = result.get("confidence", 0)
    claims = result.get("claims", [])

    verified_count = sum(1 for c in claims if c.get("verified"))
    total_claims = len(claims)
    verification_rate = verified_count / total_claims if total_claims > 0 else 0

    if confidence < CONFIDENCE_LOW:
        return "NOT_ENOUGH_INFO"

    if verification_rate >= 0.5:
        return "SUPPORTS"
    elif verification_rate < 0.3:
        return "REFUTES"

    if confidence >= CONFIDENCE_HIGH:
        return "SUPPORTS" if verification_rate >= 0.4 else "REFUTES"

    return "NOT_ENOUGH_INFO"


def query_browseai(claim: str, depth: str = "fast", retries: int = 2) -> dict | None:
    """Query BrowseAI Dev API for a claim."""
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"

    for attempt in range(retries + 1):
        try:
            resp = requests.post(
                f"{API_BASE}/api/answer",
                json={"query": f"Verify this climate claim: {claim}", "depth": depth},
                headers=headers,
                timeout=60,
            )
            if resp.status_code == 429:
                time.sleep(2 ** attempt * 5)
                continue
            if resp.status_code == 200:
                data = resp.json()
                return data.get("result", data)
            return None
        except (requests.Timeout, requests.ConnectionError):
            if attempt < retries:
                time.sleep(2 ** attempt)
            continue
    return None


def run_benchmark(limit: int | None, depth: str, concurrency: int):
    """Run CLIMATE-FEVER benchmark."""
    print("Loading CLIMATE-FEVER dataset...")
    ds = load_dataset("tdiggelm/climate_fever", split="test")

    if limit:
        ds = ds.select(range(min(limit, len(ds))))

    print(f"Running {len(ds)} claims against {API_BASE} (depth={depth})")

    predictions = []
    stats = {"SUPPORTS": 0, "REFUTES": 0, "NOT_ENOUGH_INFO": 0, "failed": 0}

    def process_claim(idx, item):
        claim_text = item["claim"]
        gold_label = LABEL_MAP.get(item["claim_label"], "NOT_ENOUGH_INFO")
        result = query_browseai(claim_text, depth=depth)

        if result is None:
            return idx, None

        pred_label = map_to_fever_label(result)
        return idx, {
            "claim_id": idx,
            "claim": claim_text,
            "pred_label": pred_label,
            "gold_label": gold_label,
            "confidence": result.get("confidence", 0),
            "verification_rate": (
                sum(1 for c in result.get("claims", []) if c.get("verified"))
                / max(len(result.get("claims", [])), 1)
            ),
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
            stats[pred["pred_label"]] += 1

    predictions.sort(key=lambda x: x["claim_id"])

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out_file = RESULTS_DIR / f"climate_fever_{depth}_{len(predictions)}.json"
    with open(out_file, "w") as f:
        json.dump(predictions, f, indent=2)

    print(f"\nResults saved to {out_file}")
    print(f"\nPrediction distribution: {stats}")
    return predictions


def evaluate(predictions: list[dict]):
    """Compute classification metrics."""
    from sklearn.metrics import accuracy_score, classification_report

    golds = [p["gold_label"] for p in predictions if p.get("gold_label")]
    preds = [p["pred_label"] for p in predictions if p.get("gold_label")]

    if not golds:
        print("No gold labels available.")
        return

    acc = accuracy_score(golds, preds)
    print(f"\n{'='*50}")
    print(f"CLIMATE-FEVER Accuracy: {acc:.1%} ({sum(g==p for g,p in zip(golds,preds))}/{len(golds)})")
    print(f"Baseline (zero-shot FEVER): 38.78%")
    print(f"{'='*50}")
    print(f"\n{classification_report(golds, preds, zero_division=0)}")


def main():
    parser = argparse.ArgumentParser(description="CLIMATE-FEVER Benchmark Runner")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--depth", default="fast", choices=["fast", "thorough"])
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--evaluate-only", type=str, default=None)

    args = parser.parse_args()

    if args.evaluate_only:
        with open(args.evaluate_only) as f:
            predictions = json.load(f)
        evaluate(predictions)
        return

    predictions = run_benchmark(args.limit, args.depth, args.concurrency)
    evaluate(predictions)


if __name__ == "__main__":
    main()
