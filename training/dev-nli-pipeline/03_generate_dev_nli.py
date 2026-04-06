#!/usr/bin/env python3
"""
Step 3: Generate dev-specific NLI pairs from SO premises.

Three strategies (no expensive LLM for entailment/contradiction):
1. SUPPORTS — pair premise with its source question (natural entailment)
2. REFUTES — programmatic negation (version swaps, boolean negation, framework swaps, number changes)
3. NOT_ENOUGH_INFO — LLM generates related-but-unverifiable hypotheses (batched, cheap)

Only NEI uses LLM (~$10-15 instead of $82 for all three).
"""

import json
import logging
import random
import re
import sys
from collections import Counter
from pathlib import Path

from tqdm import tqdm

from config import (
    GENERATED_DIR,
    LOG_FILE,
    PREMISES_FILE,
    RAW_DIR,
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

OUTFILE = GENERATED_DIR / "dev_nli_pairs.jsonl"

# ─── Programmatic contradiction patterns ─────────────────────────────

# Boolean negation
BOOL_NEGATIONS = [
    (r"\bis\b", "is not"),
    (r"\bwas\b", "was not"),
    (r"\bare\b", "are not"),
    (r"\bwere\b", "were not"),
    (r"\bcan\b", "cannot"),
    (r"\bwill\b", "will not"),
    (r"\bdoes\b", "does not"),
    (r"\bhas\b", "does not have"),
    (r"\bshould\b", "should not"),
    (r"\bsupports?\b", "does not support"),
    (r"\brequires?\b", "does not require"),
    (r"\ballows?\b", "does not allow"),
    (r"\benables?\b", "does not enable"),
    (r"\bworks?\b", "does not work"),
    (r"\bneeds?\b", "does not need"),
    (r"\buses?\b", "does not use"),
    (r"\breturns?\b", "does not return"),
    (r"\baccepts?\b", "does not accept"),
    (r"\bprovides?\b", "does not provide"),
    (r"\bincludes?\b", "does not include"),
    (r"\bcreates?\b", "does not create"),
    (r"\bhandl(?:es?|ing)\b", "does not handle"),
]

# Already-negated patterns (flip back to positive)
NEGATION_REMOVALS = [
    (r"\bis not\b", "is"),
    (r"\bisn't\b", "is"),
    (r"\bare not\b", "are"),
    (r"\baren't\b", "are"),
    (r"\bcannot\b", "can"),
    (r"\bcan't\b", "can"),
    (r"\bwon't\b", "will"),
    (r"\bwill not\b", "will"),
    (r"\bdoes not\b", "does"),
    (r"\bdoesn't\b", "does"),
    (r"\bdon't\b", "do"),
    (r"\bdo not\b", "do"),
    (r"\bhas no\b", "has"),
    (r"\bnever\b", "always"),
    (r"\bno longer\b", "still"),
    (r"\bnot supported\b", "supported"),
    (r"\bnot required\b", "required"),
    (r"\bnot recommended\b", "recommended"),
    (r"\bdeprecated\b", "still supported"),
    (r"\bobsolete\b", "current"),
    (r"\bunsafe\b", "safe"),
    (r"\binsecure\b", "secure"),
]

# Framework/language swaps
TECH_SWAPS = [
    ("React", "Vue"), ("Vue", "React"),
    ("Angular", "React"), ("React", "Angular"),
    ("Python", "Ruby"), ("Ruby", "Python"),
    ("JavaScript", "TypeScript"), ("TypeScript", "JavaScript"),
    ("Node.js", "Deno"), ("Deno", "Node.js"),
    ("npm", "yarn"), ("yarn", "npm"),
    ("MySQL", "PostgreSQL"), ("PostgreSQL", "MySQL"),
    ("MongoDB", "Redis"), ("Redis", "MongoDB"),
    ("Docker", "Podman"), ("Podman", "Docker"),
    ("Linux", "Windows"), ("Windows", "Linux"),
    ("REST", "GraphQL"), ("GraphQL", "REST"),
    ("Git", "SVN"), ("SVN", "Git"),
    ("Flask", "Django"), ("Django", "Flask"),
    ("Express", "Fastify"), ("Fastify", "Express"),
    ("AWS", "Azure"), ("Azure", "GCP"), ("GCP", "AWS"),
    ("Rust", "Go"), ("Go", "Rust"),
    ("Java", "Kotlin"), ("Kotlin", "Java"),
    ("CSS", "SCSS"), ("SCSS", "CSS"),
    ("webpack", "Vite"), ("Vite", "webpack"),
    ("pip", "conda"), ("conda", "pip"),
]

# Version number perturbation
VERSION_PATTERN = re.compile(r"\b(\d+)\.(\d+)(?:\.(\d+))?\b")


def negate_premise(premise: str) -> str | None:
    """Generate a contradiction by negating the premise."""
    text = premise

    # Strategy 1: If already contains negation, remove it
    for pattern, replacement in NEGATION_REMOVALS:
        if re.search(pattern, text, re.IGNORECASE):
            result = re.sub(pattern, replacement, text, count=1, flags=re.IGNORECASE)
            if result != text:
                return result

    # Strategy 2: Add negation
    for pattern, replacement in BOOL_NEGATIONS:
        if re.search(pattern, text, re.IGNORECASE):
            result = re.sub(pattern, replacement, text, count=1, flags=re.IGNORECASE)
            if result != text:
                return result

    return None


def swap_tech(premise: str) -> str | None:
    """Generate a contradiction by swapping technology names."""
    for original, replacement in TECH_SWAPS:
        if original.lower() in premise.lower():
            # Case-preserving replacement
            pattern = re.compile(re.escape(original), re.IGNORECASE)
            result = pattern.sub(replacement, premise, count=1)
            if result != premise:
                return result
    return None


def perturb_version(premise: str) -> str | None:
    """Generate a contradiction by changing version numbers."""
    match = VERSION_PATTERN.search(premise)
    if not match:
        return None

    major = int(match.group(1))
    minor = int(match.group(2))

    # Change major or minor version
    if random.random() < 0.5 and major > 0:
        new_major = major - 1 if random.random() < 0.5 else major + 1
        new_ver = f"{new_major}.{minor}"
    else:
        new_minor = max(0, minor + random.choice([-2, -1, 1, 2]))
        new_ver = f"{major}.{new_minor}"

    if match.group(3):
        new_ver += f".{match.group(3)}"

    result = premise[:match.start()] + new_ver + premise[match.end():]
    return result if result != premise else None


def perturb_number(premise: str) -> str | None:
    """Generate a contradiction by changing numeric values."""
    # Find numbers that aren't part of versions
    numbers = list(re.finditer(r"(?<!\d\.)\b(\d{1,6})\b(?!\.\d)", premise))
    if not numbers:
        return None

    match = random.choice(numbers)
    num = int(match.group(1))
    if num == 0:
        new_num = random.randint(1, 10)
    elif num < 10:
        new_num = num + random.choice([-2, -1, 1, 2, 3])
        new_num = max(0, new_num)
    else:
        factor = random.choice([0.5, 0.7, 1.5, 2.0])
        new_num = int(num * factor)

    if new_num == num:
        new_num = num + 1

    result = premise[:match.start()] + str(new_num) + premise[match.end():]
    return result if result != premise else None


def generate_contradiction(premise: str) -> str | None:
    """Try multiple strategies to generate a contradiction."""
    strategies = [
        (negate_premise, 0.4),
        (swap_tech, 0.25),
        (perturb_version, 0.2),
        (perturb_number, 0.15),
    ]

    # Shuffle by weight
    random.shuffle(strategies)
    strategies.sort(key=lambda x: -x[1])

    for fn, _ in strategies:
        result = fn(premise)
        if result and result != premise and len(result) > 10:
            return result

    return None


def clean_question_as_hypothesis(question_html: str) -> str | None:
    """Convert SO question HTML to a hypothesis statement."""
    # Strip HTML
    text = re.sub(r"<pre>.*?</pre>", " ", question_html, flags=re.DOTALL)
    text = re.sub(r"<code>.*?</code>", lambda m: m.group(0).replace("<code>", "`").replace("</code>", "`"), text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # Get first sentence/question
    sentences = re.split(r"[.!?]\s+", text)
    if not sentences:
        return None

    hyp = sentences[0].strip()

    # Skip if too short/long or just code
    if len(hyp) < 15 or len(hyp) > 300:
        return None
    if hyp.count("`") > 6:
        return None

    # Convert question to statement if possible
    hyp = re.sub(r"^(How (do|can|to)|Why (does|is|do)|What (is|are|does))\s+", "", hyp, flags=re.IGNORECASE)

    return hyp


def main():
    log.info("=" * 60)
    log.info("Step 3: Generate dev-specific NLI pairs")
    log.info("=" * 60)

    # Load premises
    premises = []
    with open(PREMISES_FILE) as f:
        for line in f:
            premises.append(json.loads(line))
    log.info(f"Loaded {len(premises):,} premises")

    # Load raw SO data for questions (keyed by qid)
    questions = {}
    so_file = RAW_DIR / "stackoverflow.jsonl"
    if so_file.exists():
        with open(so_file) as f:
            for line in f:
                d = json.loads(line)
                qid = d.get("qid", "")
                if qid not in questions:
                    questions[qid] = d.get("question", "")
        log.info(f"Loaded {len(questions):,} SO questions")

    random.seed(42)

    # Generate pairs
    pairs = []
    stats = Counter()

    for p in tqdm(premises, desc="Generating NLI pairs", unit="premise"):
        premise_text = p["premise"]
        qid = p.get("qid", "")

        # ── SUPPORTS: pair with question (natural entailment) ──
        if qid in questions:
            hyp = clean_question_as_hypothesis(questions[qid])
            if hyp and len(hyp) > 15:
                pairs.append({
                    "premise": premise_text,
                    "hypothesis": hyp,
                    "label": 0,  # SUPPORTS
                    "source": "so_qa_entail",
                })
                stats["supports_qa"] += 1

        # ── REFUTES: programmatic contradiction ──
        contradiction = generate_contradiction(premise_text)
        if contradiction:
            pairs.append({
                "premise": premise_text,
                "hypothesis": contradiction,
                "label": 1,  # REFUTES
                "source": "so_programmatic_contradict",
            })
            stats["refutes_prog"] += 1

        # ── SUPPORTS: self-paraphrase (premise is true of itself) ──
        # Use a different premise from same qid as supporting evidence
        # (Skip for now — the QA pairs above handle this)

    # ── NOT_ENOUGH_INFO: random premise-hypothesis pairing ──
    # Pair premises with questions from DIFFERENT qids → naturally neutral
    log.info("Generating NEI pairs from cross-qid pairing...")
    premise_list = [p for p in premises if p.get("qid") in questions]
    random.shuffle(premise_list)

    nei_target = min(len(pairs) // 2, 300_000)  # balance with other labels
    nei_count = 0

    for i in range(0, len(premise_list) - 1, 2):
        if nei_count >= nei_target:
            break

        p1 = premise_list[i]
        p2 = premise_list[i + 1]

        # Only pair if different questions (so they're truly unrelated)
        if p1["qid"] == p2["qid"]:
            continue

        # Premise from one, question-as-hypothesis from another
        q2_hyp = clean_question_as_hypothesis(questions.get(p2["qid"], ""))
        if q2_hyp and len(q2_hyp) > 15:
            pairs.append({
                "premise": p1["premise"],
                "hypothesis": q2_hyp,
                "label": 2,  # NOT_ENOUGH_INFO
                "source": "so_cross_neutral",
            })
            nei_count += 1
            stats["nei_cross"] += 1

        # Also: premise from one, premise from another as hypothesis
        if nei_count < nei_target and p1["qid"] != p2["qid"]:
            pairs.append({
                "premise": p1["premise"],
                "hypothesis": p2["premise"],
                "label": 2,  # NOT_ENOUGH_INFO
                "source": "so_cross_neutral_pp",
            })
            nei_count += 1
            stats["nei_cross_pp"] += 1

    # Shuffle
    random.shuffle(pairs)

    # Write output
    with open(OUTFILE, "w") as f:
        for pair in pairs:
            f.write(json.dumps(pair) + "\n")

    # Stats
    label_dist = Counter(p["label"] for p in pairs)
    source_dist = Counter(p["source"] for p in pairs)

    log.info(f"\n{'='*50}")
    log.info(f"Total dev NLI pairs: {len(pairs):,}")
    log.info(f"\nLabel distribution:")
    label_names = {0: "SUPPORTS", 1: "REFUTES", 2: "NOT_ENOUGH_INFO"}
    for lid in sorted(label_dist):
        log.info(f"  {label_names[lid]}: {label_dist[lid]:,} ({label_dist[lid]/len(pairs)*100:.1f}%)")
    log.info(f"\nGeneration strategy:")
    for src, cnt in source_dist.most_common():
        log.info(f"  {src}: {cnt:,}")
    log.info(f"\nOutput: {OUTFILE}")
    log.info(f"Cost: $0 (no LLM needed)")


if __name__ == "__main__":
    main()
