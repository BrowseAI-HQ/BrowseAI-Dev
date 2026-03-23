# Is This True?

A minimal web app to fact-check any sentence. Paste a claim, get a confidence score, sources, and contradictions.

Built with [BrowseAI](https://browseai.dev) Python SDK + FastAPI. No build step, no JavaScript framework -- just `pip install` and run.

![screenshot placeholder](https://browseai.dev/og-image.png)

## Quick start

```bash
cd examples/is-this-true

# Install dependencies
pip install -r requirements.txt

# Set your API key (get one at https://browseai.dev)
export BROWSEAI_API_KEY=bai_xxx

# Run
python app.py
```

Open [http://localhost:8000](http://localhost:8000).

## How it works

1. You type a claim like "The Great Wall of China is visible from space"
2. The app calls `client.ask(query)` via the BrowseAI Python SDK
3. BrowseAI's verification pipeline runs:
   - Web search across multiple sources
   - BM25 sentence matching to ground claims
   - Cross-source consensus detection
   - Contradiction detection between sources
   - 8-factor evidence-based confidence scoring
4. You see the result: confidence meter, verified answer, claims breakdown, sources, and any contradictions

## Features

- **Confidence meter** -- visual bar colored by score (red/yellow/green)
- **Claim-level verification** -- each claim marked as verified or unverified, with consensus level
- **Contradiction detection** -- conflicting claims highlighted with source attribution
- **Source quotes** -- relevant quotes extracted from each source
- **Pipeline trace** -- see every step of the verification pipeline with timing
- **Shareable results** -- each result gets a unique URL you can share
- **Thorough mode** -- toggle for deeper analysis (auto-retries with rephrased query when confidence < 60%)

## Project structure

```
is-this-true/
  app.py              # FastAPI backend (single file)
  templates/
    index.html         # Frontend with inline CSS/JS (single file)
  requirements.txt     # Python dependencies
  README.md            # This file
```

## Customization

**Use your own keys instead of a BrowseAI API key:**

```python
client = BrowseAIDev(tavily_key="tvly-xxx", openrouter_key="sk-or-xxx")
```

**Change the default depth:**

Edit `app.py` and change the default `depth` parameter in the `check` endpoint.

**Deploy:**

This is a standard FastAPI app. Deploy anywhere that runs Python -- Railway, Render, Fly.io, or a VPS with `uvicorn app:app --host 0.0.0.0 --port 8000`.

## Links

- [BrowseAI Docs](https://browseai.dev)
- [Python SDK on PyPI](https://pypi.org/project/browseaidev/)
- [GitHub](https://github.com/BrowseAI-HQ/BrowserAI-Dev)
- [Discord](https://discord.gg/ubAuT4YQsT)
