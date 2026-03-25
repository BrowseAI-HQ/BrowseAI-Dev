# Healthcare Agent

A medical research agent that verifies health claims using evidence-backed search with contradiction detection. Built on [BrowseAI Dev](https://browseai.dev).

## What it does

- Verifies medical claims against multiple sources
- Detects contradictions between studies (e.g., conflicting trial results)
- Shows consensus levels for each claim
- Ranks sources by domain authority (prioritizing medical journals, health organizations)
- Uses `depth="thorough"` for multi-pass verification critical in healthcare

## How to run

```bash
pip install browseaidev
export BROWSEAI_API_KEY=bai_xxx
python agent.py
```

Or pass a custom query:

```bash
python agent.py "What are the side effects of GLP-1 receptor agonists?"
```

## What it demonstrates

- **Thorough mode**: Iterative confidence-gated verification loop
- **Contradiction detection**: Finds disagreements between medical sources
- **Claim verification**: Each claim is individually verified with source counts
- **Domain authority**: Medical sources ranked by credibility

## Example queries

```bash
python agent.py "Is intermittent fasting safe for diabetics?"
python agent.py "Current evidence on long COVID treatments"
python agent.py "Are statins effective for primary prevention in low-risk patients?"
python agent.py "Safety of mRNA vaccines during pregnancy"
```

## License

Apache 2.0 — part of the [BrowseAI Dev](https://github.com/BrowseAI-HQ/BrowseAI-Dev) project.
