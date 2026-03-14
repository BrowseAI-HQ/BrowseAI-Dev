# Content Agent

Write blog posts where every stat, claim, and fact is verified with real citations. No hallucinated numbers.

The Content Agent takes a topic, researches it across multiple angles using BrowseAI sessions, writes a cited blog post, and runs a final verification sweep. Every claim gets a source citation, every statistic gets a confidence score, and contradictions between sources are explicitly called out.

## How it works

The agent runs four phases:

### Phase 1: Research

Creates a BrowseAI research session and runs 6 queries covering different angles of the topic:

- Latest statistics and data
- Current trends and developments
- Challenges and concerns
- Expert opinions and predictions
- Real-world examples and case studies
- Economic impact and market size

All queries use `depth="thorough"` which auto-retries with rephrased queries when initial confidence is below 60%.

### Phase 2: Outline

Creates a structured blog post outline with 8 sections:

1. Introduction
2. By the Numbers: Key Statistics
3. Current Trends and Developments
4. Challenges and Concerns
5. Expert Perspectives
6. Real-World Examples
7. What Lies Ahead
8. Conclusion

### Phase 3: Write

For each section, the agent writes content using ONLY verified claims from the research:

- Every statistic gets an inline confidence score: `(**85% confidence**)` or `(*62% confidence*)`
- Every claim gets source citations: `[1]`, `[2]`, etc.
- Contradictions are called out as blockquotes: `> Note: Sources disagree on...`
- Unverified claims are marked with `*(unverified)*`
- Duplicate claims across queries are deduplicated

### Phase 4: Verify

Runs the entire draft through BrowseAI's `ask` endpoint one more time to catch any remaining unverified claims. Aggregates all contradictions from every research query into a final report.

## Output

The agent produces a markdown file containing:

- Inline citations `[1]`, `[2]` throughout the text
- Confidence scores next to key statistics
- A **Sources** section with numbered references (URL, title, domain)
- A **Verification Report** showing:
  - X/Y claims verified (with percentage)
  - Number of contradictions found
  - Average confidence across all research queries
  - List of unverified statements

The terminal also shows a **Before vs After** comparison:

- **Before:** A raw LLM draft with fabricated statistics (no citations, no verification)
- **After:** The verified draft with real data, citations, and confidence scores

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

### Pass a topic as an argument

```bash
python agent.py "Impact of AI on software engineering jobs"
```

### Interactive mode

```bash
python agent.py
# Enter blog post topic: The state of remote work in 2026
```

### Custom output file

```bash
python agent.py "AI in healthcare" -o healthcare-post.md
```

### Skip the Before vs After comparison

```bash
python agent.py "Quantum computing progress" --no-compare
```

## Example: AI and Software Engineering Jobs

```bash
python agent.py "Impact of AI on software engineering jobs"
```

The agent will:

1. Research the topic across 6 queries (statistics, trends, challenges, expert views, examples, economic impact)
2. Create a blog post outline with 8 sections
3. Write each section using only verified claims from BrowseAI
4. Run a final verification sweep
5. Save the result to `impact-of-ai-on-software-engineering-jobs.md`

Example terminal output:

```
╭─────────────────────────────────────────────────╮
│          CONTENT AGENT                          │
│   Write verified blog posts — powered by        │
│   BrowseAI                                      │
│                                                 │
│   Every stat gets a confidence score. Every     │
│   claim gets a citation. Contradictions are     │
│   called out. No hallucinated numbers.          │
╰─────────────────────────────────────────────────╯

Topic: Impact of AI on software engineering jobs

──────────── Phase 1: Research ────────────────────
Researching 6 angles on: Impact of AI on...
Session created: content-agent-1710412800

Researching... ████████████████████ 100%

Research complete: 6 queries, 34 claims, 22 unique sources

──────────── Phase 2: Outline ─────────────────────
Blog post outline:
  1. Introduction: Impact of AI on software...
  2. By the Numbers: Key Statistics
  3. Current Trends and Developments
  ...

──────────── Phase 3: Write ───────────────────────
Building each section from verified claims only...

Writing... ████████████████████ 100%

Draft complete: 8 sections, 28/34 claims verified

──────────── Phase 4: Final Verification ──────────
Running final verification sweep...

Verification complete: 28/34 claims verified, 2 contradictions

──────────── Verification Report ──────────────────
   Claims verified: 28/34 (82%)
Contradictions found: 2
  Average confidence: ██████████████░░░░░░ 68%

──────────── Before vs After ──────────────────────

┌─ BEFORE: Raw LLM Draft (Hallucinated Stats) ───┐
│                                                 │
│ AI is transforming this field at an              │
│ unprecedented rate. According to recent studies, │
│ the market is worth $500 billion...              │
│                                                 │
│ Note: These statistics are illustrative. A raw   │
│ LLM generates plausible-sounding numbers...      │
└─────────────────────────────────────────────────┘

┌─ AFTER: Verified Draft (Real Citations) ────────┐
│                                                 │
│ GitHub reports that Copilot generates 46% of    │
│ code for developers who use it (**82%           │
│ confidence**) [3][7]                            │
│                                                 │
│ McKinsey estimates AI could automate 30% of     │
│ current work activities by 2030 (*65%           │
│ confidence*) [1][4][12]                         │
│                                                 │
│ > Note: Sources disagree on job displacement    │
│ > — One source states "AI will eliminate 25%    │
│ > of coding jobs" while another claims "AI      │
│ > will create more engineering roles than it    │
│ > displaces."                                   │
└─────────────────────────────────────────────────┘

        What Changed
┌───────────────────┬───────────────┬──────────────────┐
│ Aspect            │ Raw LLM       │ Verified Agent   │
├───────────────────┼───────────────┼──────────────────┤
│ Statistics        │ Made-up       │ Real data with   │
│                   │ numbers       │ confidence scores│
│ Citations         │ None          │ Inline [1], [2]  │
│ Contradictions    │ Hidden        │ Explicitly       │
│                   │               │ called out       │
└───────────────────┴───────────────┴──────────────────┘

──────────────────── Done ─────────────────────────

╭─────────────────────────────────────────────────╮
│ Blog post saved to:                             │
│ impact-of-ai-on-software-engineering-jobs.md    │
│                                                 │
│ Total time: 52.3s                               │
│ Claims verified: 28/34                          │
│ Sources cited: 22                               │
│ Contradictions: 2                               │
╰─────────────────────────────────────────────────╯
```

## Topics to try

```bash
python agent.py "The state of AI in healthcare 2026"
python agent.py "Remote work productivity statistics"
python agent.py "Electric vehicle adoption worldwide"
python agent.py "Quantum computing commercial applications"
python agent.py "Impact of social media on teen mental health"
python agent.py "State of the global semiconductor industry"
```

## How verification works

The Content Agent relies on BrowseAI's verification pipeline:

| Step | What it does |
|------|-------------|
| Web search | Tavily API finds relevant sources |
| BM25 matching | Sentence-level matching finds supporting quotes |
| Cross-source consensus | Claims verified across multiple independent sources |
| Domain authority | 10,000+ domains scored (5-tier + Bayesian dynamic blending) |
| Contradiction detection | Identifies conflicting claims across sources |
| 7-factor confidence | Source count, domain diversity, claim grounding, citation depth, verification rate, domain authority, consensus score |

The `depth="thorough"` mode auto-retries with a rephrased query when confidence is below 60%, ensuring higher-quality results.

## Requirements

- Python 3.10+
- A [BrowseAI API key](https://browseai.dev) (`bai_xxx` prefix)
- Dependencies: `browseai`, `rich`

## License

MIT — part of the [BrowseAI](https://github.com/BrowseAI-HQ/BrowseAI-Dev) project.
