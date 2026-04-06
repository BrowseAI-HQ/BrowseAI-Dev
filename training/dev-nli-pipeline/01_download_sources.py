#!/usr/bin/env python3
"""
Step 1: Download developer-focused data from MULTIPLE sources.

Sources:
1. Stack Overflow (HuggingFace mirrors) — Q&A pairs
2. VitaminC — contrastive fact revision pairs (MIT license)
3. DocNLI — document-level NLI pairs (Salesforce)
4. FEVER — fact verification claims + evidence
5. SciNLI — NLP/CompLing NLI pairs
6. WANLI — GPT-generated NLI pairs
7. Stack Exchange Paired — curated SO preferences
8. GitHub Code Docstrings — code + documentation pairs
"""

import json
import logging
import sys
import time
from pathlib import Path

from datasets import load_dataset
from tqdm import tqdm

from config import (
    ACCEPTED_ANSWERS_ONLY,
    LOG_FILE,
    MIN_ANSWER_SCORE,
    MIN_QUESTION_SCORE,
    RAW_DIR,
    RAW_POSTS_FILE,
    TARGET_TAGS,
)

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


def tag_matches(post_tags) -> list[str]:
    """Return list of matching tags from a post."""
    if post_tags is None:
        return []
    if isinstance(post_tags, str):
        post_tags = [t.strip().lower() for t in post_tags.replace(",", " ").replace("<", " ").replace(">", " ").split()]
    else:
        post_tags = [t.strip().lower() for t in post_tags]
    return [t for t in post_tags if t in TARGET_TAGS]


def save_records(records: list[dict], filepath: Path, append: bool = False):
    """Save records to JSONL."""
    mode = "a" if append else "w"
    with open(filepath, mode) as f:
        for r in records:
            f.write(json.dumps(r) + "\n")
    log.info(f"  Saved {len(records):,} records to {filepath.name}")


def count_file(filepath: Path) -> int:
    """Count lines in a JSONL file."""
    if not filepath.exists():
        return 0
    with open(filepath) as f:
        return sum(1 for _ in f)


# ============================================================
# Source 1: Stack Overflow (stack-exchange-preferences)
# ============================================================
def download_stackoverflow():
    """Download SO Q&A pairs from HuggingFace (SO-only shards)."""
    outfile = RAW_DIR / "stackoverflow.jsonl"
    existing = count_file(outfile)
    if existing >= 300_000:
        log.info(f"SO: Already have {existing:,} records. Skipping.")
        return existing

    log.info("SO: Loading Stackoverflow.com shards only (streaming)...")
    # Load ONLY the SO subset — full dataset includes all Stack Exchange sites
    dataset = load_dataset(
        "HuggingFaceH4/stack-exchange-preferences",
        data_files="data/Stackoverflow.com/*.parquet",
        split="train",
        streaming=True,
    )

    kept = existing
    seen_ids = set()
    if outfile.exists() and existing > 0:
        with open(outfile) as f:
            for line in f:
                seen_ids.add(json.loads(line).get("qid", ""))
        out_f = open(outfile, "a")
    else:
        out_f = open(outfile, "w")

    total_scanned = 0
    try:
        for item in tqdm(dataset, desc="SO posts", unit="post"):
            total_scanned += 1
            qid = str(item.get("qid", item.get("question_id", total_scanned)))
            if qid in seen_ids:
                continue

            question = item.get("question", "")
            # All SO posts are dev-relevant, so no tag filtering needed
            # Just filter by answer quality
            answers = item.get("answers", [])
            if not answers:
                continue

            for ans in answers:
                ans_score = ans.get("pm_score", ans.get("score", 0))
                try:
                    ans_score = float(ans_score)
                except (ValueError, TypeError):
                    ans_score = 0
                if ans_score < MIN_ANSWER_SCORE:
                    continue
                ans_text = ans.get("text", ans.get("body", ""))
                if not ans_text or len(ans_text) < 50:
                    continue

                record = {
                    "qid": qid,
                    "question": question if isinstance(question, str) else str(question),
                    "answer": ans_text,
                    "answer_score": ans_score,
                    "tags": [],
                    "source": "stackoverflow",
                    "type": "qa",
                }
                out_f.write(json.dumps(record) + "\n")
                out_f.flush()
                kept += 1

            seen_ids.add(qid)
            if total_scanned % 50000 == 0:
                log.info(f"  SO: Scanned {total_scanned:,}, kept {kept:,}")
            if kept >= 500_000:
                break

    except KeyboardInterrupt:
        log.info(f"  SO: Interrupted at {kept:,}")
    finally:
        out_f.close()

    log.info(f"  SO: Done. {kept:,} records.")
    return kept


# ============================================================
# Source 2: VitaminC — contrastive fact revisions (MIT)
# ============================================================
def download_vitaminc():
    """VitaminC: 400K+ contrastive NLI pairs from Wikipedia revisions."""
    outfile = RAW_DIR / "vitaminc.jsonl"
    existing = count_file(outfile)
    if existing >= 100_000:
        log.info(f"VitaminC: Already have {existing:,}. Skipping.")
        return existing

    log.info("VitaminC: Loading tals/vitaminc...")
    records = []
    try:
        dataset = load_dataset("tals/vitaminc", split="train", streaming=True)
        for item in tqdm(dataset, desc="VitaminC", unit="pair"):
            premise = item.get("evidence", "")
            hypothesis = item.get("claim", "")
            label_str = item.get("label", "")

            if not premise or not hypothesis:
                continue
            if len(premise) < 20 or len(hypothesis) < 10:
                continue

            # VitaminC labels: SUPPORTS, REFUTES, NOT ENOUGH INFO
            label_map = {"SUPPORTS": 0, "REFUTES": 2, "NOT ENOUGH INFO": 1}
            label = label_map.get(str(label_str).upper(), None)
            if label is None:
                try:
                    label = int(label_str)
                except (ValueError, TypeError):
                    continue

            records.append({
                "premise": premise,
                "hypothesis": hypothesis,
                "label": label,
                "source": "vitaminc",
                "type": "nli_ready",
            })

            if len(records) >= 400_000:
                break

    except Exception as e:
        log.warning(f"VitaminC error: {e}")

    if records:
        save_records(records, outfile)
    log.info(f"  VitaminC: {len(records):,} pairs.")
    return len(records)


# ============================================================
# Source 3: FEVER — fact verification
# ============================================================
def download_fever():
    """FEVER: 185K claims with evidence from Wikipedia."""
    outfile = RAW_DIR / "fever.jsonl"
    existing = count_file(outfile)
    if existing >= 50_000:
        log.info(f"FEVER: Already have {existing:,}. Skipping.")
        return existing

    log.info("FEVER: Loading fever/fever_generated...")
    records = []
    try:
        # Try different FEVER dataset variants
        for name in ["fever/fever_generated", "pietrolesci/fever"]:
            try:
                dataset = load_dataset(name, split="train", streaming=True)
                for item in tqdm(dataset, desc=f"FEVER ({name})", unit="claim"):
                    claim = item.get("claim", "")
                    evidence = item.get("evidence", item.get("evidence_sentence", ""))
                    label_str = item.get("label", item.get("gold_label", ""))

                    if not claim or not evidence:
                        continue
                    if isinstance(evidence, list):
                        evidence = " ".join(str(e) for e in evidence)
                    if len(evidence) < 20:
                        continue

                    label_map = {"SUPPORTS": 0, "REFUTES": 2, "NOT ENOUGH INFO": 1,
                                 "entailment": 0, "contradiction": 2, "neutral": 1}
                    label = label_map.get(str(label_str).upper(), None)
                    if label is None:
                        try:
                            label = int(label_str)
                        except (ValueError, TypeError):
                            continue

                    records.append({
                        "premise": evidence,
                        "hypothesis": claim,
                        "label": label,
                        "source": "fever",
                        "type": "nli_ready",
                    })

                    if len(records) >= 185_000:
                        break
                if records:
                    break
            except Exception:
                continue
    except Exception as e:
        log.warning(f"FEVER error: {e}")

    if records:
        save_records(records, outfile)
    log.info(f"  FEVER: {len(records):,} pairs.")
    return len(records)


# ============================================================
# Source 4: WANLI — GPT-generated NLI
# ============================================================
def download_wanli():
    """WANLI: 108K worker-and-AI NLI pairs."""
    outfile = RAW_DIR / "wanli.jsonl"
    existing = count_file(outfile)
    if existing >= 50_000:
        log.info(f"WANLI: Already have {existing:,}. Skipping.")
        return existing

    log.info("WANLI: Loading alisawuffles/WANLI...")
    records = []
    try:
        dataset = load_dataset("alisawuffles/WANLI", split="train", streaming=True)
        for item in tqdm(dataset, desc="WANLI", unit="pair"):
            premise = item.get("premise", "")
            hypothesis = item.get("hypothesis", "")
            label_str = item.get("gold", item.get("label", ""))

            if not premise or not hypothesis:
                continue

            label_map = {"entailment": 0, "neutral": 1, "contradiction": 2}
            label = label_map.get(str(label_str).lower(), None)
            if label is None:
                continue

            records.append({
                "premise": premise,
                "hypothesis": hypothesis,
                "label": label,
                "source": "wanli",
                "type": "nli_ready",
            })

            if len(records) >= 108_000:
                break
    except Exception as e:
        log.warning(f"WANLI error: {e}")

    if records:
        save_records(records, outfile)
    log.info(f"  WANLI: {len(records):,} pairs.")
    return len(records)


# ============================================================
# Source 5: SNLI + MultiNLI (foundation)
# ============================================================
def download_snli_mnli():
    """SNLI (570K) + MultiNLI (433K) as foundation NLI data."""
    outfile = RAW_DIR / "snli_mnli.jsonl"
    existing = count_file(outfile)
    if existing >= 500_000:
        log.info(f"SNLI+MNLI: Already have {existing:,}. Skipping.")
        return existing

    records = []

    # SNLI
    log.info("SNLI: Loading stanfordnlp/snli...")
    try:
        dataset = load_dataset("stanfordnlp/snli", split="train", streaming=True)
        for item in tqdm(dataset, desc="SNLI", unit="pair"):
            premise = item.get("premise", "")
            hypothesis = item.get("hypothesis", "")
            label = item.get("label", -1)
            if label == -1 or not premise or not hypothesis:
                continue
            records.append({
                "premise": premise,
                "hypothesis": hypothesis,
                "label": label,  # 0=entailment, 1=neutral, 2=contradiction
                "source": "snli",
                "type": "nli_ready",
            })
    except Exception as e:
        log.warning(f"SNLI error: {e}")

    # MultiNLI
    log.info("MNLI: Loading nyu-mll/multi_nli...")
    try:
        dataset = load_dataset("nyu-mll/multi_nli", split="train", streaming=True)
        for item in tqdm(dataset, desc="MNLI", unit="pair"):
            premise = item.get("premise", "")
            hypothesis = item.get("hypothesis", "")
            label = item.get("label", -1)
            if label == -1 or not premise or not hypothesis:
                continue
            records.append({
                "premise": premise,
                "hypothesis": hypothesis,
                "label": label,
                "source": "mnli",
                "type": "nli_ready",
            })
    except Exception as e:
        log.warning(f"MNLI error: {e}")

    if records:
        save_records(records, outfile)
    log.info(f"  SNLI+MNLI: {len(records):,} pairs.")
    return len(records)


# ============================================================
# Source 6: ANLI (Adversarial NLI)
# ============================================================
def download_anli():
    """ANLI: Adversarial NLI — harder examples across 3 rounds."""
    outfile = RAW_DIR / "anli.jsonl"
    existing = count_file(outfile)
    if existing >= 100_000:
        log.info(f"ANLI: Already have {existing:,}. Skipping.")
        return existing

    log.info("ANLI: Loading facebook/anli...")
    records = []
    try:
        for split in ["train_r1", "train_r2", "train_r3"]:
            try:
                dataset = load_dataset("facebook/anli", split=split, streaming=True)
                for item in tqdm(dataset, desc=f"ANLI {split}", unit="pair"):
                    premise = item.get("premise", "")
                    hypothesis = item.get("hypothesis", "")
                    label = item.get("label", -1)
                    if label == -1 or not premise or not hypothesis:
                        continue
                    records.append({
                        "premise": premise,
                        "hypothesis": hypothesis,
                        "label": label,
                        "source": f"anli_{split}",
                        "type": "nli_ready",
                    })
            except Exception as e:
                log.warning(f"ANLI {split} error: {e}")
    except Exception as e:
        log.warning(f"ANLI error: {e}")

    if records:
        save_records(records, outfile)
    log.info(f"  ANLI: {len(records):,} pairs.")
    return len(records)


# ============================================================
# Source 7: LingNLI
# ============================================================
def download_lingnli():
    """LingNLI: Linguistically diverse NLI examples."""
    outfile = RAW_DIR / "lingnli.jsonl"
    existing = count_file(outfile)
    if existing >= 50_000:
        log.info(f"LingNLI: Already have {existing:,}. Skipping.")
        return existing

    log.info("LingNLI: Loading...")
    records = []
    try:
        dataset = load_dataset("alisawuffles/LingNLI", split="train", streaming=True)
        for item in tqdm(dataset, desc="LingNLI", unit="pair"):
            premise = item.get("premise", "")
            hypothesis = item.get("hypothesis", "")
            label_str = item.get("label", "")
            if not premise or not hypothesis:
                continue
            label_map = {"entailment": 0, "neutral": 1, "contradiction": 2, "e": 0, "n": 1, "c": 2}
            label = label_map.get(str(label_str).lower(), None)
            if label is None:
                try:
                    label = int(label_str)
                except (ValueError, TypeError):
                    continue
            records.append({
                "premise": premise,
                "hypothesis": hypothesis,
                "label": label,
                "source": "lingnli",
                "type": "nli_ready",
            })
            if len(records) >= 100_000:
                break
    except Exception as e:
        log.warning(f"LingNLI error: {e}")

    if records:
        save_records(records, outfile)
    log.info(f"  LingNLI: {len(records):,} pairs.")
    return len(records)


# ============================================================
# Source 8: DocNLI (Salesforce) — document-level NLI
# ============================================================
def download_docnli():
    """DocNLI: 1.3M document-level NLI pairs."""
    outfile = RAW_DIR / "docnli.jsonl"
    existing = count_file(outfile)
    if existing >= 500_000:
        log.info(f"DocNLI: Already have {existing:,}. Skipping.")
        return existing

    log.info("DocNLI: Loading saibo/doc-nli...")
    records = []
    try:
        dataset = load_dataset("saibo/doc-nli", split="train", streaming=True)
        for item in tqdm(dataset, desc="DocNLI", unit="pair"):
            premise = item.get("premise", item.get("document", ""))
            hypothesis = item.get("hypothesis", item.get("claim", ""))
            label_str = item.get("label", "")
            if not premise or not hypothesis:
                continue
            # Truncate very long premises for manageability
            if len(premise) > 1000:
                premise = premise[:1000]
            label_map = {"entailment": 0, "not_entailment": 2, "neutral": 1,
                         "contradiction": 2, "1": 0, "0": 2}
            label = label_map.get(str(label_str).lower(), None)
            if label is None:
                try:
                    label = int(label_str)
                except (ValueError, TypeError):
                    continue
            records.append({
                "premise": premise,
                "hypothesis": hypothesis,
                "label": label,
                "source": "docnli",
                "type": "nli_ready",
            })
            if len(records) >= 1_000_000:
                break
    except Exception as e:
        log.warning(f"DocNLI error: {e}")

    if records:
        save_records(records, outfile)
    log.info(f"  DocNLI: {len(records):,} pairs.")
    return len(records)


# ============================================================
# Main
# ============================================================
def print_summary():
    """Print total records from all sources."""
    log.info("\n" + "=" * 60)
    log.info("DOWNLOAD SUMMARY")
    log.info("=" * 60)
    total = 0
    nli_ready = 0
    qa_raw = 0
    for f in sorted(RAW_DIR.glob("*.jsonl")):
        count = count_file(f)
        total += count

        # Check type
        with open(f) as fh:
            first = json.loads(fh.readline())
            rtype = first.get("type", "unknown")

        if rtype == "nli_ready":
            nli_ready += count
        else:
            qa_raw += count

        log.info(f"  {f.name:30s}: {count:>10,}  ({rtype})")

    log.info(f"\n  Total records:     {total:,}")
    log.info(f"  NLI-ready pairs:   {nli_ready:,}")
    log.info(f"  Raw QA (need LLM): {qa_raw:,}")

    est_from_qa = int(qa_raw * 3.5 * 3)  # ~3.5 premises * 3 hypotheses
    est_total = nli_ready + est_from_qa
    log.info(f"\n  Estimated total NLI pairs: ~{est_total:,}")
    log.info(f"    From existing NLI datasets: {nli_ready:,}")
    log.info(f"    From QA via LLM generation: ~{est_from_qa:,}")
    log.info("=" * 60)


if __name__ == "__main__":
    start = time.time()
    log.info("=" * 60)
    log.info("Step 1: Download ALL developer-focused data sources")
    log.info("=" * 60)

    # Download all sources — each is resumable independently
    totals = {}
    totals["stackoverflow"] = download_stackoverflow()
    totals["vitaminc"] = download_vitaminc()
    totals["fever"] = download_fever()
    totals["wanli"] = download_wanli()
    totals["snli_mnli"] = download_snli_mnli()
    totals["anli"] = download_anli()
    totals["lingnli"] = download_lingnli()
    totals["docnli"] = download_docnli()

    print_summary()

    elapsed = time.time() - start
    log.info(f"\nCompleted in {elapsed/60:.1f} minutes.")
