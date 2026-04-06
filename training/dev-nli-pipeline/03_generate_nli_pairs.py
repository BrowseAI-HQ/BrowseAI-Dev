#!/usr/bin/env python3
"""
Step 3: Generate NLI hypothesis pairs using Gemini Flash via OpenRouter.

For each premise, generates 3 hypotheses (entailment, contradiction, neutral)
with developer-specific focus on version sensitivity, API accuracy, and
framework-specific behavior.
"""

import asyncio
import json
import logging
import sys
import time
from collections import defaultdict

import aiohttp
from tqdm import tqdm

from config import (
    AVG_OUTPUT_TOKENS,
    AVG_PREMISE_TOKENS,
    GENERATED_FILE,
    INPUT_COST_PER_1M_TOKENS,
    LLM_BATCH_SIZE,
    LLM_MAX_CONCURRENT,
    LLM_MAX_RETRIES,
    LLM_MODEL,
    LLM_RATE_LIMIT_RPM,
    LLM_RETRY_DELAY,
    LOG_FILE,
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    OUTPUT_COST_PER_1M_TOKENS,
    PREMISES_FILE,
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


# --- Prompt template ---
NLI_GENERATION_PROMPT = """You are generating training data for a Natural Language Inference (NLI) model specialized in developer/technical content.

Given a PREMISE (a factual technical statement), generate exactly 3 HYPOTHESES:

1. ENTAILMENT: A claim that is clearly and directly supported by the premise. Rephrase or paraphrase the key fact.
2. CONTRADICTION: A claim that directly contradicts the premise. Use these strategies:
   - Change version numbers (e.g., "React 18" → "React 16", "Python 3.11" → "Python 2.7")
   - Swap similar API/function names (e.g., "useState" → "useReducer", "map()" → "filter()")
   - Negate capabilities ("supports" → "does not support", "allows" → "prevents")
   - Change framework/language names where it creates a factual error
   - Alter time-sensitive facts (release dates, deprecation timelines)
3. NEUTRAL: A related claim that cannot be confirmed or denied from the premise alone. It should be plausible and topically related but the premise gives no evidence for or against it.

IMPORTANT:
- All hypotheses must be natural-sounding developer claims (as if from docs or SO answers)
- Contradictions should be subtle and realistic (the kind of mistake a developer might actually make)
- Keep each hypothesis to 1-2 sentences
- Do NOT include labels or numbering in the hypotheses themselves

PREMISE: {premise}

Respond in this exact JSON format (no markdown, no code fences):
{{"entailment": "...", "contradiction": "...", "neutral": "..."}}"""


class RateLimiter:
    """Token bucket rate limiter for API calls."""

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


async def call_openrouter(
    session: aiohttp.ClientSession,
    premise: str,
    rate_limiter: RateLimiter,
    semaphore: asyncio.Semaphore,
) -> dict | None:
    """Call OpenRouter API for a single premise."""
    async with semaphore:
        await rate_limiter.acquire()

        prompt = NLI_GENERATION_PROMPT.format(premise=premise)
        payload = {
            "model": LLM_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 500,
        }
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://browseai.dev",
            "X-Title": "BrowseAI-Dev NLI Training Pipeline",
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
                        retry_after = float(resp.headers.get("Retry-After", LLM_RETRY_DELAY * (2 ** attempt)))
                        log.warning(f"Rate limited. Waiting {retry_after:.1f}s...")
                        await asyncio.sleep(retry_after)
                        continue

                    if resp.status != 200:
                        body = await resp.text()
                        log.warning(f"API error {resp.status}: {body[:200]}")
                        await asyncio.sleep(LLM_RETRY_DELAY * (2 ** attempt))
                        continue

                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"].strip()

                    # Parse JSON response - handle possible markdown fences
                    content = content.strip()
                    if content.startswith("```"):
                        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
                        content = content.rsplit("```", 1)[0]
                    content = content.strip()

                    result = json.loads(content)

                    if all(k in result for k in ("entailment", "contradiction", "neutral")):
                        return result
                    else:
                        log.warning(f"Missing keys in response: {list(result.keys())}")
                        return None

            except json.JSONDecodeError as e:
                log.warning(f"JSON parse error: {e}")
                if attempt < LLM_MAX_RETRIES - 1:
                    await asyncio.sleep(LLM_RETRY_DELAY * (2 ** attempt))
                continue
            except asyncio.TimeoutError:
                log.warning(f"Timeout on attempt {attempt + 1}")
                await asyncio.sleep(LLM_RETRY_DELAY * (2 ** attempt))
                continue
            except Exception as e:
                log.warning(f"Unexpected error: {e}")
                if attempt < LLM_MAX_RETRIES - 1:
                    await asyncio.sleep(LLM_RETRY_DELAY * (2 ** attempt))
                continue

        return None


async def process_batch(
    premises: list[dict],
    session: aiohttp.ClientSession,
    rate_limiter: RateLimiter,
    semaphore: asyncio.Semaphore,
    out_f,
    pbar: tqdm,
    stats: dict,
):
    """Process a batch of premises concurrently."""
    tasks = []
    for p in premises:
        task = call_openrouter(session, p["premise"], rate_limiter, semaphore)
        tasks.append((p, task))

    results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)

    for (premise_data, _), result in zip(tasks, results):
        if isinstance(result, Exception):
            log.warning(f"Task exception: {result}")
            stats["errors"] += 1
            pbar.update(1)
            continue

        if result is None:
            stats["errors"] += 1
            pbar.update(1)
            continue

        # Write 3 NLI pairs
        label_map = {"entailment": 0, "neutral": 1, "contradiction": 2}
        for label_name, label_id in label_map.items():
            hypothesis = result.get(label_name, "")
            if not hypothesis or len(hypothesis) < 10:
                stats["empty_hypotheses"] += 1
                continue

            pair = {
                "premise": premise_data["premise"],
                "hypothesis": hypothesis,
                "label": label_id,
                "source": premise_data.get("source", ""),
                "tags": premise_data.get("tags", []),
            }
            out_f.write(json.dumps(pair) + "\n")
            stats["pairs_written"] += 1
            stats["label_counts"][label_id] += 1

        stats["premises_processed"] += 1
        pbar.update(1)


async def main():
    log.info("=" * 60)
    log.info("Step 3: Generate NLI pairs via LLM")
    log.info("=" * 60)

    if not OPENROUTER_API_KEY:
        log.error("OPENROUTER_API_KEY not set. Export it and retry.")
        sys.exit(1)

    if not PREMISES_FILE.exists():
        log.error(f"Premises file not found: {PREMISES_FILE}")
        log.error("Run 02_extract_premises.py first.")
        sys.exit(1)

    # Load premises
    log.info("Loading premises...")
    premises = []
    with open(PREMISES_FILE, "r") as f:
        for line in f:
            premises.append(json.loads(line))
    log.info(f"Loaded {len(premises):,} premises")

    # Check for resume - load already processed premises
    processed_premises = set()
    if GENERATED_FILE.exists():
        with open(GENERATED_FILE, "r") as f:
            for line in f:
                obj = json.loads(line)
                processed_premises.add(obj["premise"])
        log.info(f"Resuming: {len(processed_premises):,} premises already processed")

    # Filter out already processed
    remaining = [p for p in premises if p["premise"] not in processed_premises]
    log.info(f"Remaining to process: {len(remaining):,}")

    if not remaining:
        log.info("All premises already processed!")
        return

    # Cost estimate
    est_input_tokens = len(remaining) * AVG_PREMISE_TOKENS
    est_output_tokens = len(remaining) * AVG_OUTPUT_TOKENS
    est_cost = (est_input_tokens / 1_000_000 * INPUT_COST_PER_1M_TOKENS) + \
               (est_output_tokens / 1_000_000 * OUTPUT_COST_PER_1M_TOKENS)
    est_time_mins = len(remaining) / LLM_RATE_LIMIT_RPM
    log.info(f"\nEstimated cost: ${est_cost:.2f}")
    log.info(f"Estimated input tokens: {est_input_tokens:,}")
    log.info(f"Estimated output tokens: {est_output_tokens:,}")
    log.info(f"Estimated time at {LLM_RATE_LIMIT_RPM} RPM: {est_time_mins:.0f} minutes")
    log.info("")

    # Setup
    rate_limiter = RateLimiter(LLM_RATE_LIMIT_RPM)
    semaphore = asyncio.Semaphore(LLM_MAX_CONCURRENT)

    stats = {
        "premises_processed": 0,
        "pairs_written": 0,
        "errors": 0,
        "empty_hypotheses": 0,
        "label_counts": defaultdict(int),
    }

    out_f = open(GENERATED_FILE, "a")

    try:
        async with aiohttp.ClientSession() as session:
            pbar = tqdm(total=len(remaining), desc="Generating NLI pairs", unit="premise")

            # Process in batches
            for i in range(0, len(remaining), LLM_BATCH_SIZE):
                batch = remaining[i:i + LLM_BATCH_SIZE]
                await process_batch(batch, session, rate_limiter, semaphore, out_f, pbar, stats)

                # Flush periodically
                out_f.flush()

                # Log progress every 100 batches
                if (i // LLM_BATCH_SIZE) % 100 == 0 and i > 0:
                    log.info(
                        f"Progress: {stats['premises_processed']:,} premises, "
                        f"{stats['pairs_written']:,} pairs, "
                        f"{stats['errors']:,} errors"
                    )

            pbar.close()

    except KeyboardInterrupt:
        log.info("Interrupted. Progress saved for resume.")
    finally:
        out_f.close()

    # Final stats
    log.info(f"\nGeneration complete:")
    log.info(f"  Premises processed: {stats['premises_processed']:,}")
    log.info(f"  Pairs written: {stats['pairs_written']:,}")
    log.info(f"  Errors: {stats['errors']:,}")
    log.info(f"  Empty hypotheses: {stats['empty_hypotheses']:,}")
    log.info(f"  Label distribution:")
    log.info(f"    Entailment (0): {stats['label_counts'][0]:,}")
    log.info(f"    Neutral    (1): {stats['label_counts'][1]:,}")
    log.info(f"    Contradiction (2): {stats['label_counts'][2]:,}")
    log.info(f"  Saved to: {GENERATED_FILE}")

    # Actual cost estimate from processed count
    actual_input = stats["premises_processed"] * AVG_PREMISE_TOKENS
    actual_output = stats["premises_processed"] * AVG_OUTPUT_TOKENS
    actual_cost = (actual_input / 1_000_000 * INPUT_COST_PER_1M_TOKENS) + \
                  (actual_output / 1_000_000 * OUTPUT_COST_PER_1M_TOKENS)
    log.info(f"  Estimated actual cost: ~${actual_cost:.2f}")


if __name__ == "__main__":
    start = time.time()
    asyncio.run(main())
    elapsed = time.time() - start
    log.info(f"Completed in {elapsed/60:.1f} minutes.")
