# Education Agent

A research assistant for students and researchers that provides evidence-backed answers with full citations. Built on [BrowseAI Dev](https://browseai.dev).

## What it does

- Answers research questions with verified, cited evidence
- Shows the full research process (reasoning steps, gap analysis)
- Lists all claims with verification status and consensus levels
- Provides sources formatted for citation with authority scores and quotes
- Uses `depth="deep"` for multi-step research with up to 3 iterative passes

## How to run

```bash
pip install browseaidev
export BROWSEAI_API_KEY=bai_xxx
python agent.py
```

Or pass a custom query:

```bash
python agent.py "How do black holes emit Hawking radiation?"
```

## What it demonstrates

- **Deep mode**: Multi-step research with automatic gap analysis and follow-up
- **Reasoning transparency**: Shows each research step so students see how research unfolds
- **Claim verification**: Every fact is individually verified with source counts
- **Citation-ready sources**: Sources include authority scores, quotes, and URLs

## Example queries

```bash
python agent.py "What was before the Big Bang?"
python agent.py "How do black holes emit Hawking radiation?"
python agent.py "What caused the fall of the Roman Empire?"
python agent.py "How does CRISPR gene editing work?"
```

## License

Apache 2.0 — part of the [BrowseAI Dev](https://github.com/BrowseAI-HQ/BrowseAI-Dev) project.
