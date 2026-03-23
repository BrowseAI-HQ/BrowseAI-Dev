# Debate Settler

Settle arguments with evidence, not opinions. Two people submit opposing claims, BrowseAI researches both using thorough mode, and declares a winner based on evidence strength.

## How it works

1. You enter two opposing claims (Side A and Side B)
2. BrowseAI researches both using `depth="thorough"` — this triggers automatic query rephrasing and retry when initial confidence is low
3. For each side, the tool evaluates:
   - **Confidence score** — 8-factor evidence-based algorithm (not LLM self-assessment)
   - **Source count** — How many sources back the claim
   - **Verified claims** — Claims that passed BM25 sentence matching and cross-source consensus
   - **Domain diversity** — Number of unique authoritative domains
   - **Contradictions** — Internal contradictions found in each side's evidence
4. A composite score (0-100) determines the winner
5. If scores are within 3 points, the verdict is "too close to call"

## Setup

```bash
pip install -r requirements.txt
```

Set your API key:

```bash
export BROWSEAI_API_KEY=bai_xxx
```

Or the script will prompt you for it.

## Usage

### Pass claims as arguments

```bash
python settle.py "Python is faster than JavaScript" "JavaScript is faster than Python"
```

### Interactive mode

```bash
python settle.py
# Enter Side A claim: Coffee is good for health
# Enter Side B claim: Coffee is bad for health
```

## Fun debates to try

### Programming languages

```bash
python settle.py \
  "Python is faster than JavaScript" \
  "JavaScript is faster than Python"
```

Spoiler: depends on the runtime and workload. V8 (JS) often wins on raw execution speed, but Python dominates in scientific computing thanks to NumPy/C extensions.

### Health claims

```bash
python settle.py \
  "Coffee is good for health" \
  "Coffee is bad for health"
```

Spoiler: moderate coffee consumption (3-4 cups/day) is associated with health benefits in most meta-analyses. The "bad" side usually cites excessive consumption or specific conditions.

### Work style

```bash
python settle.py \
  "Remote work increases productivity" \
  "Office work increases productivity"
```

Spoiler: studies show mixed results depending on the type of work, measurement criteria, and individual factors. This one often comes back as "too close to call."

### Tech debates

```bash
python settle.py \
  "Tabs are better than spaces for indentation" \
  "Spaces are better than tabs for indentation"
```

```bash
python settle.py \
  "Electric cars are better for the environment than gas cars" \
  "Gas cars are better for the environment than electric cars"
```

```bash
python settle.py \
  "AI will replace most jobs in 10 years" \
  "AI will create more jobs than it replaces in 10 years"
```

## How scoring works

The composite score (0-100) breaks down as:

| Factor | Max points | How it's calculated |
|--------|-----------|---------------------|
| Confidence | 40 | BrowseAI's 8-factor confidence score |
| Sources | 20 | Number of sources (capped at 10) |
| Verification rate | 20 | Ratio of verified to total claims |
| Domain diversity | 15 | Unique domains (capped at 8) |
| Contradiction penalty | -15 | -3 points per contradiction found |

A base of 5 points is added before the contradiction penalty, so a side with no contradictions gets 5 bonus points.

## Example output

```
╭─────────────────────────────────────────────╮
│          DEBATE SETTLER                     │
│   Powered by BrowseAI — Evidence-backed     │
╰─────────────────────────────────────────────╯

───────────── Researching Both Sides ─────────────

Researching Side A: Coffee is good for health
  Done in 8.3s

Researching Side B: Coffee is bad for health
  Done in 7.1s

─────────────────── Results ──────────────────────

┌─────────────────────────────────────────────────┐
│ Side A — Research Summary                       │
│                                                 │
│ Moderate coffee consumption (3-4 cups per day)  │
│ is associated with reduced risk of type 2       │
│ diabetes, Parkinson's disease, and liver        │
│ disease according to multiple meta-analyses...  │
└─────────────────────────────────────────────────┘

         Evidence Comparison
┌──────────────────┬─────────┬─────────┐
│ Metric           │ Side A  │ Side B  │
├──────────────────┼─────────┼─────────┤
│ Confidence       │ ██████░ │ ████░░░ │
│ Sources found    │ 8       │ 6       │
│ Verified claims  │ 5/6     │ 3/5     │
│ Unique domains   │ 6       │ 4       │
│ Contradictions   │ 0       │ 1       │
└──────────────────┴─────────┴─────────┘

──────────────────── Verdict ─────────────────────

╭─────────────────────────────────────────────────╮
│ SIDE A WINS by 18.3 points                      │
│                                                 │
│ "Coffee is good for health"                     │
│                                                 │
│ has stronger evidence support based on source   │
│ quality, verification rate, and cross-source    │
│ consensus.                                      │
╰─────────────────────────────────────────────────╯
```

## Requirements

- Python 3.10+
- A [BrowseAI API key](https://browseai.dev) (`bai_xxx` prefix)
- Dependencies: `browseaidev`, `rich`

## License

MIT — part of the [BrowseAI](https://github.com/BrowseAI-HQ/BrowserAI-Dev) project.
