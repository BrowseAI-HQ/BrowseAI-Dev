"""Central configuration for the dev-NLI training pipeline."""

import os
from pathlib import Path

# --- Paths ---
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PREMISES_DIR = DATA_DIR / "premises"
GENERATED_DIR = DATA_DIR / "generated"
FILTERED_DIR = DATA_DIR / "filtered"
AUGMENTED_DIR = DATA_DIR / "augmented"
FINAL_DIR = DATA_DIR / "final"
LOG_DIR = BASE_DIR / "logs"

# Create all directories
for d in [RAW_DIR, PREMISES_DIR, GENERATED_DIR, FILTERED_DIR, AUGMENTED_DIR, FINAL_DIR, LOG_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# --- OpenRouter / LLM ---
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
LLM_MODEL = "google/gemini-2.5-flash-preview"

# Generation settings
LLM_BATCH_SIZE = 20  # premises per batch
LLM_MAX_CONCURRENT = 10  # concurrent API calls
LLM_RATE_LIMIT_RPM = 200  # requests per minute
LLM_MAX_RETRIES = 3
LLM_RETRY_DELAY = 2.0  # seconds base delay (exponential backoff)

# Augmentation LLM settings (smaller edits, can be faster)
AUGMENT_BATCH_SIZE = 30
AUGMENT_MAX_CONCURRENT = 15

# --- Teacher model ---
TEACHER_MODEL = "cross-encoder/nli-deberta-v3-base"
TEACHER_CONFIDENCE_THRESHOLD = 0.7
TEACHER_BATCH_SIZE = 64

# --- Stack Overflow tags ---
TARGET_TAGS = [
    "javascript", "python", "react", "typescript", "node.js",
    "rust", "go", "java", "docker", "kubernetes",
    "aws", "postgresql", "mongodb", "redis", "git",
    "linux", "css", "html", "angular", "vue",
    "django", "flask", "fastapi", "spring",
    "tensorflow", "pytorch",
]

# --- Filtering thresholds ---
MIN_ANSWER_SCORE = 3
MIN_QUESTION_SCORE = 5
ACCEPTED_ANSWERS_ONLY = True

# --- Premise extraction ---
MIN_PREMISE_LENGTH = 30  # characters
MAX_PREMISE_LENGTH = 500  # characters
MAX_PREMISES_PER_ANSWER = 10

# --- Deduplication ---
FUZZY_SIMILARITY_THRESHOLD = 0.90  # Jaccard similarity for fuzzy dedup

# --- Train/val/test split ---
TRAIN_RATIO = 0.90
VAL_RATIO = 0.05
TEST_RATIO = 0.05

# --- Cost estimation ---
# Approximate token costs for Gemini Flash via OpenRouter
INPUT_COST_PER_1M_TOKENS = 0.15  # USD
OUTPUT_COST_PER_1M_TOKENS = 0.60  # USD
AVG_PREMISE_TOKENS = 80
AVG_OUTPUT_TOKENS = 200  # for 3 hypotheses

# --- File names ---
RAW_POSTS_FILE = RAW_DIR / "stackoverflow.jsonl"
PREMISES_FILE = PREMISES_DIR / "premises.jsonl"
GENERATED_FILE = GENERATED_DIR / "nli_pairs.jsonl"
FILTERED_FILE = FILTERED_DIR / "nli_pairs_filtered.jsonl"
AUGMENTED_FILE = AUGMENTED_DIR / "nli_pairs_augmented.jsonl"
TRAIN_FILE = FINAL_DIR / "train.jsonl"
VAL_FILE = FINAL_DIR / "val.jsonl"
TEST_FILE = FINAL_DIR / "test.jsonl"
STATS_FILE = FINAL_DIR / "stats.json"

# --- Logging ---
LOG_FILE = LOG_DIR / "pipeline.log"
