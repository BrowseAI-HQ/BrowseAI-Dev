#!/usr/bin/env python3
"""
Step 2: Extract factual premises from raw Stack Overflow answers.

Cleans HTML, strips code blocks, splits into individual factual claims,
and filters for quality.
"""

import json
import logging
import re
import sys
import time
from html.parser import HTMLParser

from tqdm import tqdm

from config import (
    LOG_FILE,
    MAX_PREMISE_LENGTH,
    MAX_PREMISES_PER_ANSWER,
    MIN_PREMISE_LENGTH,
    PREMISES_FILE,
    RAW_POSTS_FILE,
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


class HTMLTextExtractor(HTMLParser):
    """Extract text from HTML, preserving inline code as backtick-wrapped."""

    def __init__(self):
        super().__init__()
        self.result = []
        self._in_code_block = False
        self._in_inline_code = False
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag == "pre":
            self._in_code_block = True
            self._skip = True
        elif tag == "code" and not self._in_code_block:
            self._in_inline_code = True
            self.result.append("`")
        elif tag in ("script", "style"):
            self._skip = True
        elif tag in ("p", "br", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"):
            self.result.append("\n")

    def handle_endtag(self, tag):
        if tag == "pre":
            self._in_code_block = False
            self._skip = False
            self.result.append("\n")
        elif tag == "code" and not self._in_code_block:
            self._in_inline_code = False
            self.result.append("`")
        elif tag in ("script", "style"):
            self._skip = False

    def handle_data(self, data):
        if self._skip or self._in_code_block:
            return
        self.result.append(data)

    def get_text(self):
        return "".join(self.result)


def clean_html(html_text: str) -> str:
    """Remove HTML tags, keep inline code references."""
    if not html_text:
        return ""
    extractor = HTMLTextExtractor()
    try:
        extractor.feed(html_text)
        text = extractor.get_text()
    except Exception:
        # Fallback: strip all tags
        text = re.sub(r"<[^>]+>", " ", html_text)

    # Clean up whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def is_factual_statement(text: str) -> bool:
    """Filter out non-factual content (opinions, meta-commentary, etc.)."""
    text_lower = text.lower().strip()

    # Skip very short or very long
    if len(text) < MIN_PREMISE_LENGTH or len(text) > MAX_PREMISE_LENGTH:
        return False

    # Skip pure questions
    if text_lower.endswith("?") and text_lower.count("?") > text_lower.count("."):
        return False

    # Skip meta-commentary patterns
    skip_patterns = [
        r"^(edit|update|note|disclaimer|tldr|tl;dr)\s*:",
        r"^(hope this helps|good luck|cheers|happy coding)",
        r"^(i think|in my opinion|imo|imho|personally)\b",
        r"^(here is|here\'s|here are) (a|an|the|my) (example|demo|snippet|code|sample)",
        r"^(try|just|simply) (this|the following|doing)",
        r"^(see|check|refer|look at) (this|the) (link|docs|documentation|answer|post)",
        r"^(as )?mentioned (above|below|earlier|previously)",
        r"^\d+\.\s*$",  # Just a number
        r"^(yes|no|nope|yep)[.,!]?\s*$",
    ]
    for pattern in skip_patterns:
        if re.match(pattern, text_lower):
            return False

    # Must contain at least some alphabetic content
    alpha_ratio = sum(1 for c in text if c.isalpha()) / max(len(text), 1)
    if alpha_ratio < 0.4:
        return False

    # Skip if mostly code (backtick-heavy)
    backtick_count = text.count("`")
    if backtick_count > 10 or (backtick_count > 0 and backtick_count / len(text) > 0.1):
        return False

    # Should have at least one sentence-ending punctuation
    if not any(text.rstrip().endswith(p) for p in [".", "!", ")", "`"]):
        # Allow if it's a clear declarative statement
        if len(text) < 60:
            return False

    return True


def split_into_claims(text: str) -> list[str]:
    """Split cleaned text into individual factual claims/premises."""
    # Split on paragraph boundaries
    paragraphs = re.split(r"\n\n+", text)

    claims = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # If paragraph is short enough, keep as-is
        if len(para) <= MAX_PREMISE_LENGTH:
            claims.append(para)
            continue

        # Split long paragraphs into sentences
        sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", para)

        current_claim = ""
        for sent in sentences:
            sent = sent.strip()
            if not sent:
                continue

            # If adding this sentence keeps us under limit, merge
            if current_claim and len(current_claim) + len(sent) + 1 <= MAX_PREMISE_LENGTH:
                current_claim += " " + sent
            else:
                if current_claim:
                    claims.append(current_claim)
                current_claim = sent

        if current_claim:
            claims.append(current_claim)

    return claims


def extract_premises_from_answer(answer_text: str, tags: list[str], score: float, source: str, qid: str) -> list[dict]:
    """Extract factual premises from a single answer."""
    # Clean HTML
    clean_text = clean_html(answer_text)
    if not clean_text:
        return []

    # Split into claims
    raw_claims = split_into_claims(clean_text)

    # Filter for factual statements
    premises = []
    for claim in raw_claims:
        claim = claim.strip()
        if is_factual_statement(claim):
            premises.append({
                "premise": claim,
                "source": source,
                "tags": tags,
                "score": score,
                "qid": qid,
            })
            if len(premises) >= MAX_PREMISES_PER_ANSWER:
                break

    return premises


def main():
    log.info("=" * 60)
    log.info("Step 2: Extract factual premises")
    log.info("=" * 60)

    if not RAW_POSTS_FILE.exists():
        log.error(f"Raw posts file not found: {RAW_POSTS_FILE}")
        log.error("Run 01_download_sources.py first.")
        sys.exit(1)

    # Count total lines for progress bar
    total_lines = 0
    with open(RAW_POSTS_FILE, "r") as f:
        for _ in f:
            total_lines += 1
    log.info(f"Total raw answers: {total_lines:,}")

    # Check for resume
    processed_qids = set()
    if PREMISES_FILE.exists():
        with open(PREMISES_FILE, "r") as f:
            for line in f:
                obj = json.loads(line)
                processed_qids.add(obj.get("qid", ""))
        log.info(f"Resuming: {len(processed_qids):,} answer groups already processed.")
        out_f = open(PREMISES_FILE, "a")
    else:
        out_f = open(PREMISES_FILE, "w")

    total_premises = len(processed_qids)  # approximate
    skipped = 0
    errors = 0

    try:
        with open(RAW_POSTS_FILE, "r") as f:
            for line in tqdm(f, total=total_lines, desc="Extracting premises", unit="answer"):
                try:
                    post = json.loads(line)
                except json.JSONDecodeError:
                    errors += 1
                    continue

                qid = post.get("qid", "")
                if qid in processed_qids:
                    skipped += 1
                    continue

                premises = extract_premises_from_answer(
                    answer_text=post.get("answer", ""),
                    tags=post.get("tags", []),
                    score=post.get("answer_score", 0),
                    source=post.get("source", "unknown"),
                    qid=qid,
                )

                for p in premises:
                    out_f.write(json.dumps(p) + "\n")
                    total_premises += 1

                processed_qids.add(qid)

    except KeyboardInterrupt:
        log.info("Interrupted. Progress saved.")
    finally:
        out_f.close()

    log.info(f"\nExtraction complete:")
    log.info(f"  Total premises: {total_premises:,}")
    log.info(f"  Skipped (resume): {skipped:,}")
    log.info(f"  Parse errors: {errors:,}")
    log.info(f"  Saved to: {PREMISES_FILE}")

    # Print cost estimate for next step
    est_pairs = total_premises * 3
    est_input_tokens = total_premises * 80
    est_output_tokens = total_premises * 200
    est_cost = (est_input_tokens / 1_000_000 * 0.15) + (est_output_tokens / 1_000_000 * 0.60)
    log.info(f"\n  Estimated NLI pairs from generation: ~{est_pairs:,}")
    log.info(f"  Estimated LLM cost for step 3: ~${est_cost:.2f}")


if __name__ == "__main__":
    start = time.time()
    main()
    elapsed = time.time() - start
    log.info(f"Completed in {elapsed/60:.1f} minutes.")
