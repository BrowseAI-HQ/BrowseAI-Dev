#!/usr/bin/env python3
"""
Step 6: Merge all data sources, deduplicate, and create train/val/test splits.

Merges:
1. General NLI backbone (SNLI, MultiNLI, VitaminC, ANLI, WANLI) — 1.57M
2. Dev-specific NLI pairs (from SO) — 1.44M

Produces balanced, deduplicated train/val/test splits.
"""

import json
import logging
import os
import random
import sys
from collections import Counter
from pathlib import Path

from tqdm import tqdm

from config import (
    AUGMENTED_DIR,
    FINAL_DIR,
    FILTERED_DIR,
    GENERATED_DIR,
    LOG_FILE,
    STATS_FILE,
    TEST_RATIO,
    TRAIN_FILE,
    TRAIN_RATIO,
    VAL_FILE,
    VAL_RATIO,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

LABEL_NAMES = {0: "SUPPORTS", 1: "REFUTES", 2: "NOT_ENOUGH_INFO"}


def load_jsonl(path: Path) -> list[dict]:
    """Load records from JSONL file."""
    records = []
    if not path.exists():
        log.warning(f"  File not found: {path}")
        return records
    with open(path) as f:
        for line in f:
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records


def main():
    log.info("=" * 60)
    log.info("Step 6: Merge and split all data")
    log.info("=" * 60)

    # Load all sources
    # After running steps 4+5, use teacher-filtered dev pairs instead of raw generated
    dev_filtered = FILTERED_DIR / "dev_nli_pairs_filtered.jsonl"
    dev_source = dev_filtered if dev_filtered.exists() else GENERATED_DIR / "dev_nli_pairs.jsonl"
    dev_label = "Dev NLI (teacher-filtered)" if dev_filtered.exists() else "Dev NLI (generated, unfiltered)"

    # Dev-niche training: only dev-specific data (E2-Small checkpoint already has general NLI)
    # Set DEV_ONLY=1 to skip general backbone, or include it for standalone training
    dev_only = os.environ.get("DEV_ONLY", "0") == "1"

    sources = {}
    if not dev_only:
        sources["General NLI (clean)"] = FILTERED_DIR / "nli_ready_clean.jsonl"
    sources[dev_label] = dev_source
    sources["Contrastive augmented"] = AUGMENTED_DIR / "nli_pairs_augmented.jsonl"

    if dev_only:
        log.info("DEV_ONLY mode: skipping general NLI backbone (using E2-Small checkpoint as base)")

    all_records = []
    for name, path in sources.items():
        records = load_jsonl(path)
        log.info(f"  {name}: {len(records):,} records")
        all_records.extend(records)

    log.info(f"\nTotal before dedup: {len(all_records):,}")

    # Deduplicate by (premise[:200], hypothesis[:200])
    seen = set()
    deduped = []
    for rec in tqdm(all_records, desc="Deduplicating", unit="rec"):
        key = (rec["premise"][:200].lower(), rec["hypothesis"][:200].lower())
        if key not in seen:
            seen.add(key)
            deduped.append(rec)
    all_records = deduped
    log.info(f"After dedup: {len(all_records):,}")

    # Label distribution
    label_dist = Counter(r["label"] for r in all_records)
    log.info(f"\nLabel distribution:")
    for lid in sorted(label_dist):
        name = LABEL_NAMES.get(lid, f"UNK_{lid}")
        count = label_dist[lid]
        pct = count / len(all_records) * 100
        log.info(f"  {name}: {count:,} ({pct:.1f}%)")

    # Source distribution
    source_dist = Counter(r.get("source", "unknown") for r in all_records)
    log.info(f"\nSource distribution (top 15):")
    for src, count in source_dist.most_common(15):
        log.info(f"  {src}: {count:,}")

    # Shuffle with fixed seed for reproducibility
    random.seed(42)
    random.shuffle(all_records)

    # Split: train/val/test
    n = len(all_records)
    train_end = int(n * TRAIN_RATIO)
    val_end = int(n * (TRAIN_RATIO + VAL_RATIO))

    splits = {
        "train": (all_records[:train_end], TRAIN_FILE),
        "val": (all_records[train_end:val_end], VAL_FILE),
        "test": (all_records[val_end:], FINAL_DIR / "test.jsonl"),
    }

    for split_name, (records, outpath) in splits.items():
        with open(outpath, "w") as f:
            for rec in records:
                f.write(json.dumps(rec) + "\n")

        split_labels = Counter(r["label"] for r in records)
        log.info(f"\n{split_name}: {len(records):,} records -> {outpath.name}")
        for lid in sorted(split_labels):
            name = LABEL_NAMES.get(lid, f"UNK_{lid}")
            count = split_labels[lid]
            pct = count / len(records) * 100
            log.info(f"  {name}: {count:,} ({pct:.1f}%)")

    # Save stats
    stats = {
        "total_records": len(all_records),
        "splits": {
            "train": len(splits["train"][0]),
            "val": len(splits["val"][0]),
            "test": len(splits["test"][0]),
        },
        "label_distribution": {
            LABEL_NAMES[lid]: count for lid, count in label_dist.items()
        },
        "source_distribution": dict(source_dist.most_common()),
    }
    with open(STATS_FILE, "w") as f:
        json.dump(stats, f, indent=2)

    log.info(f"\nStats saved to: {STATS_FILE}")
    log.info(f"\n{'='*50}")
    log.info(f"READY FOR TRAINING")
    log.info(f"  Train: {TRAIN_FILE}")
    log.info(f"  Val:   {VAL_FILE}")
    log.info(f"  Test:  {FINAL_DIR / 'test.jsonl'}")
    log.info(f"{'='*50}")


if __name__ == "__main__":
    main()
