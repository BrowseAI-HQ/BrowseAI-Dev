# Financial Agent

A financial research agent that verifies market data and financial claims with real-time evidence. Built on [BrowseAI Dev](https://browseai.dev).

## What it does

- Verifies financial figures (revenue, earnings, delivery numbers) against multiple sources
- Detects contradictions from different reporting periods or GAAP vs non-GAAP
- Shows consensus levels so you know which numbers are widely confirmed
- Ranks sources by domain authority (prioritizing financial data providers, SEC filings)
- Uses `depth="thorough"` for multi-pass verification of time-sensitive data

## How to run

```bash
pip install browseaidev
export BROWSEAI_API_KEY=bai_xxx
python agent.py
```

Or pass a custom query:

```bash
python agent.py "Apple quarterly earnings Q1 2026"
```

## What it demonstrates

- **Real-time data**: Financial numbers from live web search, not stale training data
- **Thorough mode**: Cross-checks figures across multiple financial sources
- **Contradiction detection**: Catches discrepancies between GAAP/non-GAAP, preliminary/final
- **Source authority**: Financial sources ranked by credibility

## Example queries

```bash
python agent.py "Tesla revenue and delivery numbers 2025"
python agent.py "Apple quarterly earnings Q1 2026"
python agent.py "S&P 500 performance year to date 2026"
python agent.py "Federal Reserve interest rate decisions 2025-2026"
```

## License

Apache 2.0 — part of the [BrowseAI Dev](https://github.com/BrowseAI-HQ/BrowseAI-Dev) project.
