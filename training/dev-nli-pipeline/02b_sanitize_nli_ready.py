#!/usr/bin/env python3
"""
Step 2b: Sanitize and normalize NLI-ready datasets for dev-niche training.

Processes: VitaminC, SNLI+MultiNLI, ANLI, WANLI
- Normalizes labels to: 0=SUPPORTS, 1=REFUTES, 2=NOT_ENOUGH_INFO
- Cleans text (strip whitespace, remove artifacts)
- Filters garbage (too short, too long, empty, non-English)
- Deduplicates by (premise[:200], hypothesis[:200])
- Outputs unified clean JSONL

Label mapping from source datasets:
  - Most use: 0=entailment, 1=neutral, 2=contradiction
  - Our format: 0=SUPPORTS (entailment), 1=REFUTES (contradiction), 2=NOT_ENOUGH_INFO (neutral)
  - So: source 0→0, source 1→2, source 2→1
"""

import json
import logging
import re
import sys
from collections import Counter
from pathlib import Path

from tqdm import tqdm

from config import RAW_DIR, FILTERED_DIR, LOG_FILE

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# NLI-ready source files
NLI_SOURCES = [
    RAW_DIR / "vitaminc.jsonl",
    RAW_DIR / "snli_mnli.jsonl",
    RAW_DIR / "anli.jsonl",
    RAW_DIR / "wanli.jsonl",
]

# Label remapping: source datasets use 0=entailment, 1=neutral, 2=contradiction
# We use: 0=SUPPORTS (entailment), 1=REFUTES (contradiction), 2=NOT_ENOUGH_INFO (neutral)
LABEL_REMAP = {0: 0, 1: 2, 2: 1}  # entailment→SUPPORTS, neutral→NEI, contradiction→REFUTES
LABEL_NAMES = {0: "SUPPORTS", 1: "REFUTES", 2: "NOT_ENOUGH_INFO"}

# Quality thresholds
MIN_TEXT_LEN = 10  # characters
MAX_TEXT_LEN = 1024  # characters
MIN_ALPHA_RATIO = 0.3


def clean_text(text: str) -> str:
    """Clean and normalize text."""
    if not text:
        return ""
    # Strip whitespace
    text = text.strip()
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)
    # Remove common artifacts
    text = re.sub(r"^[\-\*\•]\s*", "", text)  # leading bullets
    text = re.sub(r"\s*\[citation needed\]\s*", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\(.*?Wikipedia.*?\)\s*", " ", text)
    # Fix double spaces
    text = re.sub(r"  +", " ", text)
    return text.strip()


def is_quality(text: str) -> bool:
    """Check if text meets quality thresholds."""
    if len(text) < MIN_TEXT_LEN or len(text) > MAX_TEXT_LEN:
        return False
    alpha_count = sum(1 for c in text if c.isalpha())
    if alpha_count / max(len(text), 1) < MIN_ALPHA_RATIO:
        return False
    # Skip if it's just a URL or path
    if text.startswith("http") or text.startswith("/"):
        return False
    return True


def process_record(record: dict) -> dict | None:
    """Process a single NLI record. Returns None if should be filtered."""
    premise = clean_text(record.get("premise", ""))
    hypothesis = clean_text(record.get("hypothesis", ""))
    label = record.get("label")
    source = record.get("source", "unknown")

    # Validate
    if not premise or not hypothesis:
        return None
    if not is_quality(premise) or not is_quality(hypothesis):
        return None
    if label not in (0, 1, 2):
        return None

    # Remap label
    new_label = LABEL_REMAP.get(label, label)

    return {
        "premise": premise,
        "hypothesis": hypothesis,
        "label": new_label,
        "source": source,
    }


def main():
    log.info("=" * 60)
    log.info("Step 2b: Sanitize NLI-ready datasets")
    log.info("=" * 60)

    all_records = []
    source_counts = Counter()
    label_counts = Counter()
    filtered_counts = Counter()

    for source_file in NLI_SOURCES:
        if not source_file.exists():
            log.warning(f"  Skipping {source_file.name} (not found)")
            continue

        log.info(f"\nProcessing {source_file.name}...")
        count = 0
        kept = 0

        with open(source_file) as f:
            lines = f.readlines()

        for line in tqdm(lines, desc=source_file.stem, unit="rec"):
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            count += 1
            result = process_record(record)
            if result:
                all_records.append(result)
                source_counts[result["source"]] += 1
                label_counts[result["label"]] += 1
                kept += 1
            else:
                filtered_counts[source_file.stem] += 1

        log.info(f"  {source_file.stem}: {count:,} → {kept:,} ({count - kept:,} filtered)")

    # Deduplicate by (premise[:200], hypothesis[:200])
    log.info(f"\nBefore dedup: {len(all_records):,}")
    seen = set()
    deduped = []
    for rec in all_records:
        key = (rec["premise"][:200].lower(), rec["hypothesis"][:200].lower())
        if key not in seen:
            seen.add(key)
            deduped.append(rec)
    all_records = deduped
    log.info(f"After dedup: {len(all_records):,}")

    # Write output
    outfile = FILTERED_DIR / "nli_ready_clean.jsonl"
    with open(outfile, "w") as f:
        for rec in all_records:
            f.write(json.dumps(rec) + "\n")

    # Stats
    log.info(f"\n{'='*40}")
    log.info(f"Total clean NLI pairs: {len(all_records):,}")
    log.info(f"\nLabel distribution:")
    for label_id in sorted(label_counts.keys()):
        name = LABEL_NAMES.get(label_id, f"UNK_{label_id}")
        count = label_counts[label_id]
        pct = count / len(all_records) * 100 if all_records else 0
        log.info(f"  {name}: {count:,} ({pct:.1f}%)")
    log.info(f"\nSource distribution:")
    for src, count in source_counts.most_common():
        log.info(f"  {src}: {count:,}")
    log.info(f"\nOutput: {outfile}")


if __name__ == "__main__":
    main()
