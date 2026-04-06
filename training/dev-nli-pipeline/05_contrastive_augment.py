#!/usr/bin/env python3
"""
Step 5: VitaminC-style contrastive augmentation.

For each entailment pair, creates a minimal-edit contradiction by:
- Swapping version numbers
- Negating capabilities
- Swapping similar API/function names
- Changing framework/language names

Uses regex patterns for deterministic edits and LLM for complex cases.
"""

import asyncio
import json
import logging
import random
import re
import sys
import time
from collections import defaultdict

import aiohttp
from tqdm import tqdm

from config import (
    AUGMENT_BATCH_SIZE,
    AUGMENT_MAX_CONCURRENT,
    AUGMENTED_FILE,
    FILTERED_DIR,
    LLM_MAX_RETRIES,
    LLM_MODEL,
    LLM_RATE_LIMIT_RPM,
    LLM_RETRY_DELAY,
    LOG_FILE,
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
)

# Dev-niche specific: read from teacher-filtered dev pairs
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


# --- Regex-based contrastive edit patterns ---

# Version swaps: detect version patterns and change them
VERSION_PATTERNS = [
    (r"\bv(\d+)\.(\d+)\.(\d+)\b", lambda m: f"v{max(1, int(m.group(1))-1)}.{m.group(2)}.{m.group(3)}"),
    (r"\bv(\d+)\.(\d+)\b", lambda m: f"v{max(1, int(m.group(1))-1)}.{m.group(2)}"),
    (r"\bv(\d+)\b", lambda m: f"v{max(1, int(m.group(1))-1)}"),
    (r"\bversion\s+(\d+)\.(\d+)", lambda m: f"version {max(1, int(m.group(1))-1)}.{m.group(2)}"),
    (r"\b(\d+)\.(\d+)\.(\d+)\b", lambda m: f"{max(1, int(m.group(1))-1)}.{m.group(2)}.{m.group(3)}"),
]

# Technology version swaps (specific frameworks)
TECH_VERSION_SWAPS = {
    "React 18": "React 16", "React 19": "React 17", "React 17": "React 15",
    "Python 3": "Python 2", "Python 3.11": "Python 3.8", "Python 3.12": "Python 3.9",
    "Node.js 18": "Node.js 14", "Node.js 20": "Node.js 16", "Node 18": "Node 14",
    "TypeScript 5": "TypeScript 4", "TypeScript 4": "TypeScript 3",
    "Angular 17": "Angular 14", "Angular 16": "Angular 13",
    "Vue 3": "Vue 2", "Vue.js 3": "Vue.js 2",
    "Java 17": "Java 11", "Java 21": "Java 17",
    "ES2022": "ES2015", "ES2023": "ES2017", "ES6": "ES5",
    "Docker 24": "Docker 20", "Kubernetes 1.28": "Kubernetes 1.24",
    "PostgreSQL 16": "PostgreSQL 13", "PostgreSQL 15": "PostgreSQL 12",
    "Redis 7": "Redis 5", "MongoDB 7": "MongoDB 5",
    "Spring Boot 3": "Spring Boot 2", "Spring 6": "Spring 5",
    "Django 5": "Django 3", "Django 4": "Django 2",
    "Go 1.21": "Go 1.18", "Go 1.22": "Go 1.19", "Rust 1.7": "Rust 1.5",
}

# API/function name swaps (similar-sounding alternatives)
API_SWAPS = {
    "useState": "useRef", "useEffect": "useLayoutEffect", "useCallback": "useMemo",
    "useMemo": "useCallback", "useRef": "useState", "useReducer": "useState",
    "useContext": "useRef", "useLayoutEffect": "useEffect",
    "map()": "filter()", "filter()": "map()", "reduce()": "forEach()",
    "forEach()": "map()", "find()": "findIndex()", "findIndex()": "find()",
    "some()": "every()", "every()": "some()", "includes()": "indexOf()",
    "querySelector": "getElementById", "getElementById": "querySelector",
    "addEventListener": "attachEvent", "removeEventListener": "detachEvent",
    "async/await": "callbacks", "Promise.all": "Promise.race",
    "Promise.allSettled": "Promise.all", "Promise.race": "Promise.any",
    "fetch()": "XMLHttpRequest", "axios": "fetch",
    "console.log": "console.info", "console.error": "console.warn",
    "JSON.parse": "JSON.stringify", "JSON.stringify": "JSON.parse",
    "localStorage": "sessionStorage", "sessionStorage": "localStorage",
    "setTimeout": "setInterval", "setInterval": "setTimeout",
    "push()": "pop()", "shift()": "unshift()", "splice()": "slice()",
    "pip install": "pip uninstall", "npm install": "npm uninstall",
    "git merge": "git rebase", "git pull": "git fetch",
    "docker run": "docker exec", "docker build": "docker create",
    "SELECT": "INSERT", "INSERT": "UPDATE", "UPDATE": "DELETE",
    "JOIN": "LEFT JOIN", "INNER JOIN": "OUTER JOIN",
    "GET": "POST", "POST": "PUT", "PUT": "PATCH", "DELETE": "GET",
}

# Negation patterns
NEGATION_SWAPS = [
    (r"\bsupports\b", "does not support"),
    (r"\bdoes not support\b", "supports"),
    (r"\ballows\b", "prevents"),
    (r"\bprevents\b", "allows"),
    (r"\benables\b", "disables"),
    (r"\bdisables\b", "enables"),
    (r"\bcan\b", "cannot"),
    (r"\bcannot\b", "can"),
    (r"\bis compatible with\b", "is incompatible with"),
    (r"\bis incompatible with\b", "is compatible with"),
    (r"\brequires\b", "does not require"),
    (r"\bdoes not require\b", "requires"),
    (r"\bincludes\b", "excludes"),
    (r"\bexcludes\b", "includes"),
    (r"\bis\b(?!\s+not)", "is not"),
    (r"\bis not\b", "is"),
    (r"\bwill\b(?!\s+not)", "will not"),
    (r"\bwill not\b", "will"),
    (r"\bhas\b(?!\s+no)", "has no"),
    (r"\bhas no\b", "has"),
]

# Framework/language confusions
FRAMEWORK_SWAPS = {
    "React": "Angular", "Angular": "Vue", "Vue": "Svelte", "Svelte": "React",
    "Django": "Flask", "Flask": "FastAPI", "FastAPI": "Django",
    "Express": "Koa", "Koa": "Fastify", "Fastify": "Express",
    "PostgreSQL": "MySQL", "MySQL": "PostgreSQL", "MongoDB": "Redis",
    "Docker": "Podman", "Kubernetes": "Docker Swarm",
    "npm": "yarn", "yarn": "pnpm", "pnpm": "npm",
    "Jest": "Mocha", "Mocha": "Jest", "pytest": "unittest",
    "webpack": "Vite", "Vite": "webpack", "Rollup": "esbuild",
}


def try_version_swap(text: str) -> str | None:
    """Try to swap a version number in the text."""
    # First try specific tech versions
    for old, new in TECH_VERSION_SWAPS.items():
        if old in text:
            return text.replace(old, new, 1)

    # Then try regex patterns
    for pattern, replacer in VERSION_PATTERNS:
        match = re.search(pattern, text)
        if match:
            new_text = text[:match.start()] + replacer(match) + text[match.end():]
            if new_text != text:
                return new_text

    return None


def try_api_swap(text: str) -> str | None:
    """Try to swap an API/function name."""
    for old, new in API_SWAPS.items():
        # Use word boundary for clean replacement
        pattern = re.escape(old)
        if re.search(pattern, text):
            return re.sub(pattern, new, text, count=1)
    return None


def try_negation(text: str) -> str | None:
    """Try to negate a capability statement."""
    for pattern, replacement in NEGATION_SWAPS:
        if re.search(pattern, text):
            result = re.sub(pattern, replacement, text, count=1)
            if result != text:
                return result
    return None


def try_framework_swap(text: str) -> str | None:
    """Try to swap a framework/language name."""
    for old, new in FRAMEWORK_SWAPS.items():
        # Only swap if it appears as a word boundary match
        pattern = r"\b" + re.escape(old) + r"\b"
        if re.search(pattern, text):
            return re.sub(pattern, new, text, count=1)
    return None


def regex_contrastive_edit(hypothesis: str) -> str | None:
    """Try all regex-based edit strategies in random order."""
    strategies = [try_version_swap, try_api_swap, try_negation, try_framework_swap]
    random.shuffle(strategies)

    for strategy in strategies:
        result = strategy(hypothesis)
        if result and result != hypothesis:
            return result

    return None


# --- LLM-based contrastive edits for cases regex can't handle ---

CONTRASTIVE_EDIT_PROMPT = """Given this developer claim, create a MINIMAL edit that makes it factually wrong.
Change as few words as possible. The result should look natural but be incorrect.

Strategies:
- Swap a version number to a wrong one
- Change an API/function name to a similar but wrong one
- Negate a capability
- Swap a framework or language name

Original claim: {hypothesis}

Respond with ONLY the edited claim, nothing else."""


class RateLimiter:
    def __init__(self, rpm: int):
        self.interval = 60.0 / rpm
        self.last_call = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            wait = self.last_call + self.interval - now
            if wait > 0:
                await asyncio.sleep(wait)
            self.last_call = time.monotonic()


async def llm_contrastive_edit(
    session: aiohttp.ClientSession,
    hypothesis: str,
    rate_limiter: RateLimiter,
    semaphore: asyncio.Semaphore,
) -> str | None:
    """Use LLM for contrastive edit when regex fails."""
    async with semaphore:
        await rate_limiter.acquire()

        payload = {
            "model": LLM_MODEL,
            "messages": [{"role": "user", "content": CONTRASTIVE_EDIT_PROMPT.format(hypothesis=hypothesis)}],
            "temperature": 0.5,
            "max_tokens": 200,
        }
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://browseai.dev",
            "X-Title": "BrowseAI-Dev NLI Augmentation",
        }

        for attempt in range(LLM_MAX_RETRIES):
            try:
                async with session.post(
                    OPENROUTER_BASE_URL,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status == 429:
                        await asyncio.sleep(LLM_RETRY_DELAY * (2 ** attempt))
                        continue
                    if resp.status != 200:
                        await asyncio.sleep(LLM_RETRY_DELAY * (2 ** attempt))
                        continue

                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    # Clean up any quotes or extra formatting
                    content = content.strip('"\'')
                    if content and content != hypothesis and len(content) > 10:
                        return content

            except Exception:
                if attempt < LLM_MAX_RETRIES - 1:
                    await asyncio.sleep(LLM_RETRY_DELAY * (2 ** attempt))
                continue

        return None


async def main():
    log.info("=" * 60)
    log.info("Step 5: Contrastive augmentation")
    log.info("=" * 60)

    if not FILTERED_FILE.exists():
        log.error(f"Filtered file not found: {FILTERED_FILE}")
        log.error("Run 04_filter_with_teacher.py first.")
        sys.exit(1)

    # Load entailment pairs only
    log.info("Loading entailment pairs for augmentation...")
    entailment_pairs = []
    with open(FILTERED_FILE, "r") as f:
        for line in f:
            record = json.loads(line)
            if record["label"] == 0:  # entailment
                entailment_pairs.append(record)
    log.info(f"Loaded {len(entailment_pairs):,} entailment pairs")

    # Check for resume
    processed_hypotheses = set()
    if AUGMENTED_FILE.exists():
        with open(AUGMENTED_FILE, "r") as f:
            for line in f:
                obj = json.loads(line)
                # Track the original hypothesis that was augmented
                processed_hypotheses.add(obj.get("original_hypothesis", "")[:100])
        log.info(f"Resuming: {len(processed_hypotheses):,} pairs already augmented")

    remaining = [p for p in entailment_pairs if p["hypothesis"][:100] not in processed_hypotheses]
    log.info(f"Remaining to augment: {len(remaining):,}")

    if not remaining:
        log.info("All pairs already augmented!")
        return

    stats = {
        "regex_edits": 0,
        "llm_edits": 0,
        "failed": 0,
        "total": 0,
    }

    # First pass: regex edits (fast, no API cost)
    log.info("\nPass 1: Regex-based contrastive edits...")
    needs_llm = []
    out_f = open(AUGMENTED_FILE, "a")

    for record in tqdm(remaining, desc="Regex augmentation", unit="pair"):
        edited = regex_contrastive_edit(record["hypothesis"])
        if edited:
            augmented = {
                "premise": record["premise"],
                "hypothesis": edited,
                "label": 1,  # REFUTES (contradiction)
                "source": record.get("source", ""),
                "tags": record.get("tags", []),
                "augmentation": "contrastive_regex",
                "original_hypothesis": record["hypothesis"],
            }
            out_f.write(json.dumps(augmented) + "\n")
            stats["regex_edits"] += 1
        else:
            needs_llm.append(record)
        stats["total"] += 1

    out_f.flush()
    log.info(f"Regex edits: {stats['regex_edits']:,}, needs LLM: {len(needs_llm):,}")

    # Second pass: LLM edits for remaining
    if needs_llm and OPENROUTER_API_KEY:
        log.info(f"\nPass 2: LLM-based contrastive edits for {len(needs_llm):,} pairs...")

        # Cost estimate
        est_tokens = len(needs_llm) * 150  # input + output per edit
        est_cost = est_tokens / 1_000_000 * (0.15 + 0.60)
        log.info(f"Estimated LLM cost: ~${est_cost:.2f}")

        rate_limiter = RateLimiter(LLM_RATE_LIMIT_RPM)
        semaphore = asyncio.Semaphore(AUGMENT_MAX_CONCURRENT)

        async with aiohttp.ClientSession() as session:
            pbar = tqdm(total=len(needs_llm), desc="LLM augmentation", unit="pair")

            for i in range(0, len(needs_llm), AUGMENT_BATCH_SIZE):
                batch = needs_llm[i:i + AUGMENT_BATCH_SIZE]
                tasks = [
                    llm_contrastive_edit(session, rec["hypothesis"], rate_limiter, semaphore)
                    for rec in batch
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for rec, result in zip(batch, results):
                    if isinstance(result, Exception) or result is None:
                        stats["failed"] += 1
                    else:
                        augmented = {
                            "premise": rec["premise"],
                            "hypothesis": result,
                            "label": 1,  # REFUTES (contradiction)
                            "source": rec.get("source", ""),
                            "tags": rec.get("tags", []),
                            "augmentation": "contrastive_llm",
                            "original_hypothesis": rec["hypothesis"],
                        }
                        out_f.write(json.dumps(augmented) + "\n")
                        stats["llm_edits"] += 1

                    pbar.update(1)

                out_f.flush()

            pbar.close()
    elif needs_llm:
        log.warning(f"Skipping {len(needs_llm):,} LLM edits (no OPENROUTER_API_KEY)")
        stats["failed"] += len(needs_llm)

    out_f.close()

    log.info(f"\nAugmentation complete:")
    log.info(f"  Total entailment pairs: {stats['total']:,}")
    log.info(f"  Regex edits: {stats['regex_edits']:,}")
    log.info(f"  LLM edits: {stats['llm_edits']:,}")
    log.info(f"  Failed: {stats['failed']:,}")
    log.info(f"  Total augmented contradictions: {stats['regex_edits'] + stats['llm_edits']:,}")
    log.info(f"  Saved to: {AUGMENTED_FILE}")


if __name__ == "__main__":
    start = time.time()
    asyncio.run(main())
    elapsed = time.time() - start
    log.info(f"Completed in {elapsed/60:.1f} minutes.")
