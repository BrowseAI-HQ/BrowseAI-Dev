# Scientific Agent

A scientific research agent that cross-checks findings and detects contradictions in the literature. Built on [BrowseAI Dev](https://browseai.dev).

## What it does

- Cross-checks research findings across multiple scientific sources
- Detects contradictions between competing theories or studies
- Shows consensus levels (strong, moderate, weak) for each claim
- Iterative gap analysis identifies what is missing and runs follow-up searches
- Uses `depth="deep"` for multi-step reasoning with up to 3 research passes

## How to run

```bash
pip install browseaidev
export BROWSEAI_API_KEY=bai_xxx
python agent.py
```

Or pass a custom query:

```bash
python agent.py "Evidence for and against the multiverse hypothesis"
```

## What it demonstrates

- **Deep mode**: Iterative research with gap analysis and follow-up queries
- **Reasoning steps**: Shows each research iteration and what gaps were identified
- **Consensus levels**: Distinguishes strong consensus from disputed findings
- **Contradiction detection**: Finds disagreements between scientific sources via semantic confidence

## Example queries

```bash
python agent.py "Current consensus on dark matter vs modified gravity"
python agent.py "Evidence for and against the multiverse hypothesis"
python agent.py "Compare CRISPR-Cas9 vs base editing for sickle cell disease"
python agent.py "Is there scientific consensus on microplastics health effects?"
```

## License

Apache 2.0 — part of the [BrowseAI Dev](https://github.com/BrowseAI-HQ/BrowseAI-Dev) project.
