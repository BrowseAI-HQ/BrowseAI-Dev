#!/usr/bin/env python3
"""
Step 7: Train dev-niche NLI model.

Fine-tunes from E2-Small checkpoint (already trained on 2.39M general NLI)
on dev-specific SO data only. The general NLI knowledge is already baked into
the checkpoint — this step adds dev-domain specialization on top.

Produces:
- PyTorch model checkpoint
- ONNX export for zero-cost CPU inference
- Evaluation metrics on held-out test set
"""

import json
import logging
import os
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from datasets import Dataset
from sklearn.metrics import classification_report, f1_score
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
)

from config import FINAL_DIR, LOG_FILE, TRAIN_FILE, VAL_FILE

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# --- Configuration ---
# Use E2-Small checkpoint as base (already trained on 2.39M general NLI)
# Falls back to pretrained if checkpoint not found
E2_SMALL_CHECKPOINT = Path("models/e2-small/best")
BASE_MODEL = str(E2_SMALL_CHECKPOINT) if E2_SMALL_CHECKPOINT.exists() else "cross-encoder/nli-deberta-v3-small"
OUTPUT_DIR = Path("models/dev-nli-small")
ONNX_DIR = OUTPUT_DIR / "onnx"

BATCH_SIZE = 64
EVAL_BATCH_SIZE = 256
LEARNING_RATE = 1e-5  # Lower LR for fine-tuning from checkpoint (not from scratch)
EPOCHS = 2  # Fewer epochs needed — base model already strong
WARMUP_RATIO = 0.06
MAX_LENGTH = 512
GRADIENT_ACCUMULATION = 1

# Label mapping: our format → model format
# Our labels: 0=SUPPORTS, 1=REFUTES, 2=NOT_ENOUGH_INFO
# cross-encoder/nli-deberta-v3-small: 0=contradiction, 1=entailment, 2=neutral
LABEL_MAP = {0: 1, 1: 0, 2: 2}  # SUPPORTS→entailment, REFUTES→contradiction, NEI→neutral
LABEL_MAP_INV = {v: k for k, v in LABEL_MAP.items()}
LABEL_NAMES = {0: "SUPPORTS", 1: "REFUTES", 2: "NOT_ENOUGH_INFO"}


def load_jsonl(path: Path) -> list[dict]:
    records = []
    with open(path) as f:
        for line in f:
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    f1_macro = f1_score(labels, preds, average="macro")
    f1_weighted = f1_score(labels, preds, average="weighted")
    accuracy = (preds == labels).mean()
    return {
        "accuracy": accuracy,
        "f1_macro": f1_macro,
        "f1_weighted": f1_weighted,
    }


def main():
    log.info("=" * 60)
    log.info("Step 7: Train dev-niche DeBERTa-v3-small")
    log.info("=" * 60)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    log.info(f"Device: {device}")
    if device == "cuda":
        log.info(f"GPU: {torch.cuda.get_device_name(0)}")
        log.info(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # Load data
    log.info(f"\nLoading training data from {TRAIN_FILE}")
    train_records = load_jsonl(TRAIN_FILE)
    log.info(f"Train records: {len(train_records):,}")

    log.info(f"Loading validation data from {VAL_FILE}")
    val_records = load_jsonl(VAL_FILE)
    log.info(f"Val records: {len(val_records):,}")

    test_file = FINAL_DIR / "test.jsonl"
    test_records = load_jsonl(test_file) if test_file.exists() else []
    log.info(f"Test records: {len(test_records):,}")

    # Label distribution
    for name, records in [("Train", train_records), ("Val", val_records), ("Test", test_records)]:
        dist = Counter(r["label"] for r in records)
        log.info(f"\n{name} label distribution:")
        for lid in sorted(dist):
            log.info(f"  {LABEL_NAMES.get(lid, lid)}: {dist[lid]:,} ({dist[lid]/len(records)*100:.1f}%)")

    # Map labels to model format
    for records in [train_records, val_records, test_records]:
        for r in records:
            r["label"] = LABEL_MAP[r["label"]]

    # Create HF datasets
    def records_to_dataset(records):
        return Dataset.from_dict({
            "premise": [r["premise"] for r in records],
            "hypothesis": [r["hypothesis"] for r in records],
            "label": [r["label"] for r in records],
        })

    train_ds = records_to_dataset(train_records)
    val_ds = records_to_dataset(val_records)
    test_ds = records_to_dataset(test_records) if test_records else None

    # Load tokenizer and model
    log.info(f"\nLoading model: {BASE_MODEL}")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(BASE_MODEL, num_labels=3)
    model.to(device)

    param_count = sum(p.numel() for p in model.parameters())
    log.info(f"Parameters: {param_count:,} ({param_count/1e6:.1f}M)")

    # Class weights for imbalanced data
    label_counts = Counter(int(x) for x in train_ds["label"])
    total = sum(label_counts.values())
    n_classes = 3
    class_weights = torch.tensor([
        total / (n_classes * label_counts.get(i, 1)) for i in range(n_classes)
    ], dtype=torch.float32).to(device)
    log.info(f"Class weights: {class_weights.tolist()}")

    # Tokenize
    def tokenize_fn(examples):
        return tokenizer(
            examples["premise"],
            examples["hypothesis"],
            truncation=True,
            max_length=MAX_LENGTH,
            padding="max_length",
        )

    log.info("Tokenizing datasets...")
    train_ds = train_ds.map(tokenize_fn, batched=True, num_proc=4, desc="Tokenizing train")
    val_ds = val_ds.map(tokenize_fn, batched=True, num_proc=4, desc="Tokenizing val")
    if test_ds:
        test_ds = test_ds.map(tokenize_fn, batched=True, num_proc=4, desc="Tokenizing test")

    # Custom trainer with class weights
    class WeightedTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
            labels = inputs.pop("labels")
            outputs = model(**inputs)
            logits = outputs.logits
            loss_fn = torch.nn.CrossEntropyLoss(weight=class_weights)
            loss = loss_fn(logits, labels)
            return (loss, outputs) if return_outputs else loss

    # Training arguments
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total_steps = (len(train_ds) // BATCH_SIZE) * EPOCHS
    warmup_steps = int(total_steps * WARMUP_RATIO)
    log.info(f"\nTraining config:")
    log.info(f"  Steps: {total_steps:,} total, {warmup_steps:,} warmup")
    log.info(f"  Batch: {BATCH_SIZE}, LR: {LEARNING_RATE}, Epochs: {EPOCHS}")

    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=EVAL_BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION,
        learning_rate=LEARNING_RATE,
        warmup_steps=warmup_steps,
        weight_decay=0.01,
        max_grad_norm=1.0,
        eval_strategy="steps",
        eval_steps=5000,
        save_strategy="steps",
        save_steps=5000,
        save_total_limit=3,
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
        greater_is_better=True,
        logging_steps=500,
        logging_first_step=True,
        bf16=torch.cuda.is_available(),
        dataloader_num_workers=4,
        report_to="none",
        seed=42,
    )

    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
    )

    # Train
    log.info("\nStarting training...")
    start_time = time.time()
    trainer.train()
    elapsed = time.time() - start_time
    log.info(f"\nTraining completed in {elapsed/3600:.1f} hours")

    # Save best model
    best_dir = OUTPUT_DIR / "best"
    trainer.save_model(str(best_dir))
    tokenizer.save_pretrained(str(best_dir))
    log.info(f"Best model saved to: {best_dir}")

    # Evaluate on test set
    if test_ds:
        log.info("\nEvaluating on test set...")
        test_results = trainer.evaluate(test_ds)
        log.info(f"Test results:")
        for k, v in test_results.items():
            log.info(f"  {k}: {v:.4f}" if isinstance(v, float) else f"  {k}: {v}")

        # Detailed classification report
        test_preds = trainer.predict(test_ds)
        pred_labels = np.argmax(test_preds.predictions, axis=-1)
        true_labels = test_preds.label_ids

        # Map back to our label names for the report
        target_names = ["contradiction(REFUTES)", "entailment(SUPPORTS)", "neutral(NEI)"]
        report = classification_report(true_labels, pred_labels, target_names=target_names)
        log.info(f"\nClassification Report:\n{report}")

    # ONNX export
    log.info("\nExporting to ONNX...")
    try:
        ONNX_DIR.mkdir(parents=True, exist_ok=True)
        dummy_input = tokenizer(
            "Example premise text.",
            "Example hypothesis text.",
            return_tensors="pt",
            max_length=MAX_LENGTH,
            truncation=True,
            padding="max_length",
        ).to(device)

        model.eval()
        onnx_path = ONNX_DIR / "model.onnx"

        torch.onnx.export(
            model,
            (dummy_input["input_ids"], dummy_input["attention_mask"]),
            str(onnx_path),
            input_names=["input_ids", "attention_mask"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch", 1: "seq"},
                "attention_mask": {0: "batch", 1: "seq"},
                "logits": {0: "batch"},
            },
            opset_version=14,
        )
        log.info(f"ONNX model exported to: {onnx_path}")
        log.info(f"ONNX size: {onnx_path.stat().st_size / 1e6:.1f} MB")

        # Save tokenizer alongside ONNX
        tokenizer.save_pretrained(str(ONNX_DIR))
        log.info(f"Tokenizer saved to: {ONNX_DIR}")
    except Exception as e:
        log.error(f"ONNX export failed: {e}")
        log.info("Model still available as PyTorch checkpoint in best/")

    # Save training summary
    summary = {
        "base_model": BASE_MODEL,
        "training_time_hours": elapsed / 3600,
        "train_size": len(train_ds),
        "val_size": len(val_ds),
        "test_size": len(test_ds) if test_ds else 0,
        "best_model_path": str(best_dir),
        "onnx_path": str(ONNX_DIR / "model.onnx"),
        "config": {
            "batch_size": BATCH_SIZE,
            "learning_rate": LEARNING_RATE,
            "epochs": EPOCHS,
            "warmup_ratio": WARMUP_RATIO,
            "max_length": MAX_LENGTH,
        },
    }
    if test_ds:
        summary["test_metrics"] = {k: float(v) for k, v in test_results.items()}

    summary_path = OUTPUT_DIR / "training_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    log.info(f"\n{'='*60}")
    log.info("TRAINING COMPLETE")
    log.info(f"  Best model: {best_dir}")
    log.info(f"  ONNX: {ONNX_DIR / 'model.onnx'}")
    log.info(f"  Summary: {summary_path}")
    log.info(f"{'='*60}")


if __name__ == "__main__":
    main()
