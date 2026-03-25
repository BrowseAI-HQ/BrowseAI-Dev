# Docs Verifier

Crawl your README or documentation, extract every factual claim, and verify each one against live web sources using BrowseAI. Flags outdated or contradicted statements.

## What it does

1. **Fetches** a document from a URL (using BrowseAI's `open()`) or reads a local file
2. **Extracts** factual claims -- sentences containing numbers, dates, comparisons, version references, capability assertions, etc.
3. **Verifies** each claim through BrowseAI's `ask()` research pipeline with evidence-backed confidence scores
4. **Reports** results as a terminal table (via `rich`) and optionally as a markdown file

Claims are flagged when:
- Confidence score is below 50% (configurable)
- Contradictions are detected between sources

## Setup

```bash
cd examples/docs-verifier
pip install -r requirements.txt
```

Set your API key:

```bash
export BROWSEAI_API_KEY="bai_xxx"
```

## Usage

### Verify a remote README

```bash
python verify_docs.py https://raw.githubusercontent.com/BrowseAI-HQ/BrowseAI-Dev/main/README.md
```

### Verify a local file

```bash
python verify_docs.py ../../README.md
```

### Use thorough mode for deeper verification

Thorough mode auto-retries with rephrased queries when first-pass confidence is below 60%.

```bash
python verify_docs.py ../../README.md --depth thorough
```

### Limit claims (useful for large docs)

```bash
python verify_docs.py ../../README.md --max-claims 10
```

### Export results as markdown

```bash
python verify_docs.py ../../README.md --output report.md
```

### Custom confidence threshold

Flag claims below 70% instead of the default 50%:

```bash
python verify_docs.py ../../README.md --confidence-threshold 0.70
```

## Example output

```
╭─ BrowseAI Docs Verifier ──────────────────────────╮
│ Extracts factual claims from documentation and     │
│ verifies each one.                                 │
╰────────────────────────────────────────────────────╯

Found 12 verifiable claim(s). Verifying...

╭─ Documentation Verification Report ───────────────╮
│ Source: ../../README.md                            │
│ Time: 34.2s                                        │
╰────────────────────────────────────────────────────╯

Total claims   12
Verified        9
Flagged         2
Errors          1

┌────┬────────┬────────────┬──────────────────────────┬──────────────────────┐
│ #  │ Status │ Confidence │ Claim                    │ Notes                │
├────┼────────┼────────────┼──────────────────────────┼──────────────────────┤
│ 1  │ OK     │ 87%        │ BrowseAI uses a 7-fac... │ 4 source(s)          │
│ 2  │ OK     │ 72%        │ The verification pipe... │ 3 source(s)          │
│ 3  │ FLAG   │ 38%        │ Supports 10,000+ doma... │ Low confidence (38%) │
│ 4  │ OK     │ 91%        │ Licensed under Apache 2.0│ 5 source(s)          │
│ ...│        │            │                          │                      │
└────┴────────┴────────────┴──────────────────────────┴──────────────────────┘

Flagged Claims (need attention):

  Claim: Supports 10,000+ domains in the authority database
  Reason: Low confidence (38%)
  Finding: The documentation claims 10,000+ domains but current data shows...
  Source: BrowseAI Documentation (https://browseai.dev/developers)
```

## How claim extraction works

The script identifies sentences that contain verifiable assertions by matching patterns:

- **Numbers and dates:** "10,000+ domains", "2024", "version 0.3"
- **Comparisons:** "faster than", "more accurate"
- **State assertions:** "is", "was", "has", "uses"
- **Capability claims:** "supports", "provides", "includes"
- **Superlatives:** "first", "only", "largest", "fastest"
- **License references:** "MIT", "Apache", "GPL"
- **Percentages:** "95% accuracy", "below 60%"

Lines that are headings, code blocks, tables, or images are automatically skipped.

## Using in CI

Exit code is non-zero when any claims are flagged, making it easy to use in CI pipelines:

```yaml
# .github/workflows/verify-docs.yml
name: Verify Docs
on:
  push:
    paths: ["README.md", "docs/**"]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r examples/docs-verifier/requirements.txt
      - run: python examples/docs-verifier/verify_docs.py README.md
        env:
          BROWSEAI_API_KEY: ${{ secrets.BROWSEAI_API_KEY }}
```

## Architecture

```
source (URL or file)
       │
       ▼
  ┌─────────────┐
  │ Fetch / Read │  ← BrowseAI open() for URLs, pathlib for local files
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │   Extract    │  ← Regex-based claim extraction (numbers, dates, assertions)
  │   Claims     │
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │   Verify     │  ← BrowseAI ask() per claim (fast or thorough mode)
  │  Each Claim  │
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │   Report     │  ← Rich terminal table + optional markdown export
  └─────────────┘
```
