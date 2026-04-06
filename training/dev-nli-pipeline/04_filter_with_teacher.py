#!/usr/bin/env python3
"""
Step 4: Filter generated NLI pairs using a teacher model.

Uses DeBERTa-v3-base-mnli-fever-anli as teacher to validate generated pairs.
Only keeps pairs where the teacher agrees with the intended label above a
confidence threshold.
"""

import json
import logging
import sys
import time
from collections import defaultdict

import torch
from tqdm import tqdm
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from config import (
    FILTERED_DIR,
    GENERATED_DIR,
    LOG_FILE,
    TEACHER_BATCH_SIZE,
    TEACHER_CONFIDENCE_THRESHOLD,
    TEACHER_MODEL,
)

# Dev-niche specific files (step 3 output → step 4 filtered output)
GENERATED_FILE = GENERATED_DIR / "dev_nli_pairs.jsonl"
FILTERED_FILE = FILTERED_DIR / "dev_nli_pairs_filtered.jsonl"

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


# Label mapping: our labels -> teacher model labels
# Our labels: 0=SUPPORTS(entailment), 1=REFUTES(contradiction), 2=NOT_ENOUGH_INFO(neutral)
# DeBERTa MNLI labels: 0=contradiction, 1=neutral, 2=entailment
OUR_TO_TEACHER = {0: 2, 1: 0, 2: 1}  # SUPPORTS->entailment, REFUTES->contradiction, NEI->neutral
TEACHER_LABEL_NAMES = {0: "contradiction", 1: "neutral", 2: "entailment"}


def load_teacher_model(model_name: str):
    """Load teacher model and tokenizer."""
    log.info(f"Loading teacher model: {model_name}")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)

    # Use GPU if available
    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    model = model.to(device)
    model.eval()
    log.info(f"Model loaded on device: {device}")
    return model, tokenizer, device


def predict_batch(
    model,
    tokenizer,
    device: str,
    premises: list[str],
    hypotheses: list[str],
) -> list[tuple[int, float]]:
    """Run inference on a batch. Returns list of (predicted_label, confidence)."""
    inputs = tokenizer(
        premises,
        hypotheses,
        padding=True,
        truncation=True,
        max_length=512,
        return_tensors="pt",
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=-1)
        predictions = torch.argmax(probs, dim=-1)
        confidences = torch.max(probs, dim=-1).values

    return list(zip(predictions.cpu().tolist(), confidences.cpu().tolist()))


def main():
    log.info("=" * 60)
    log.info("Step 4: Filter with teacher model")
    log.info("=" * 60)

    if not GENERATED_FILE.exists():
        log.error(f"Generated file not found: {GENERATED_FILE}")
        log.error("Run 03_generate_nli_pairs.py first.")
        sys.exit(1)

    # Count total pairs
    total_pairs = 0
    with open(GENERATED_FILE, "r") as f:
        for _ in f:
            total_pairs += 1
    log.info(f"Total generated pairs: {total_pairs:,}")

    # Check for resume
    processed_keys = set()
    if FILTERED_FILE.exists():
        with open(FILTERED_FILE, "r") as f:
            for line in f:
                obj = json.loads(line)
                key = (obj["premise"][:100], obj["hypothesis"][:100])
                processed_keys.add(key)
        log.info(f"Resuming: {len(processed_keys):,} pairs already filtered")

    # Load teacher model
    model, tokenizer, device = load_teacher_model(TEACHER_MODEL)

    # Stats
    stats = {
        "total": 0,
        "kept": len(processed_keys),
        "rejected": 0,
        "errors": 0,
        "agreement_by_label": defaultdict(lambda: {"agree": 0, "disagree": 0}),
        "teacher_predictions": defaultdict(int),
        "confidence_sum": 0.0,
    }

    # Process in batches
    batch_premises = []
    batch_hypotheses = []
    batch_records = []

    out_f = open(FILTERED_FILE, "a")

    try:
        with open(GENERATED_FILE, "r") as f:
            pbar = tqdm(total=total_pairs, desc="Filtering pairs", unit="pair")

            for line in f:
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    stats["errors"] += 1
                    pbar.update(1)
                    continue

                # Skip already processed
                key = (record["premise"][:100], record["hypothesis"][:100])
                if key in processed_keys:
                    pbar.update(1)
                    continue

                batch_premises.append(record["premise"])
                batch_hypotheses.append(record["hypothesis"])
                batch_records.append(record)

                if len(batch_premises) >= TEACHER_BATCH_SIZE:
                    # Run inference
                    predictions = predict_batch(model, tokenizer, device, batch_premises, batch_hypotheses)

                    for rec, (pred_label, confidence) in zip(batch_records, predictions):
                        our_label = rec["label"]
                        expected_teacher_label = OUR_TO_TEACHER[our_label]

                        stats["total"] += 1
                        stats["teacher_predictions"][pred_label] += 1
                        stats["confidence_sum"] += confidence

                        if pred_label == expected_teacher_label and confidence >= TEACHER_CONFIDENCE_THRESHOLD:
                            # Teacher agrees with intended label
                            rec["teacher_confidence"] = round(confidence, 4)
                            out_f.write(json.dumps(rec) + "\n")
                            stats["kept"] += 1
                            stats["agreement_by_label"][our_label]["agree"] += 1
                        else:
                            stats["rejected"] += 1
                            stats["agreement_by_label"][our_label]["disagree"] += 1

                    # Reset batch
                    batch_premises = []
                    batch_hypotheses = []
                    batch_records = []
                    pbar.update(TEACHER_BATCH_SIZE)

            # Process remaining
            if batch_premises:
                predictions = predict_batch(model, tokenizer, device, batch_premises, batch_hypotheses)
                for rec, (pred_label, confidence) in zip(batch_records, predictions):
                    our_label = rec["label"]
                    expected_teacher_label = OUR_TO_TEACHER[our_label]

                    stats["total"] += 1
                    stats["teacher_predictions"][pred_label] += 1
                    stats["confidence_sum"] += confidence

                    if pred_label == expected_teacher_label and confidence >= TEACHER_CONFIDENCE_THRESHOLD:
                        rec["teacher_confidence"] = round(confidence, 4)
                        out_f.write(json.dumps(rec) + "\n")
                        stats["kept"] += 1
                        stats["agreement_by_label"][our_label]["agree"] += 1
                    else:
                        stats["rejected"] += 1
                        stats["agreement_by_label"][our_label]["disagree"] += 1

                pbar.update(len(batch_premises))

            pbar.close()

    except KeyboardInterrupt:
        log.info("Interrupted. Progress saved.")
    finally:
        out_f.close()

    # Print stats
    log.info(f"\nFiltering complete:")
    log.info(f"  Total processed: {stats['total']:,}")
    log.info(f"  Kept (teacher agrees): {stats['kept']:,}")
    log.info(f"  Rejected: {stats['rejected']:,}")
    log.info(f"  Keep rate: {stats['kept']/max(stats['total'],1)*100:.1f}%")
    log.info(f"  Parse errors: {stats['errors']:,}")
    log.info(f"  Avg teacher confidence: {stats['confidence_sum']/max(stats['total'],1):.3f}")

    log.info(f"\n  Agreement by intended label:")
    label_names = {0: "SUPPORTS", 1: "REFUTES", 2: "NOT_ENOUGH_INFO"}
    for label_id in [0, 1, 2]:
        agree = stats["agreement_by_label"][label_id]["agree"]
        disagree = stats["agreement_by_label"][label_id]["disagree"]
        total = agree + disagree
        rate = agree / max(total, 1) * 100
        log.info(f"    {label_names[label_id]:15s}: {agree:,}/{total:,} ({rate:.1f}% agreement)")

    log.info(f"\n  Teacher prediction distribution:")
    for label_id, count in sorted(stats["teacher_predictions"].items()):
        log.info(f"    {TEACHER_LABEL_NAMES.get(label_id, label_id):15s}: {count:,}")

    log.info(f"\n  Saved to: {FILTERED_FILE}")


if __name__ == "__main__":
    start = time.time()
    main()
    elapsed = time.time() - start
    log.info(f"Completed in {elapsed/60:.1f} minutes.")
