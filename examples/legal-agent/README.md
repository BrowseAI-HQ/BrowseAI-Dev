# Legal Agent

A legal research agent that cross-references regulatory and compliance claims against current sources. Built on [BrowseAI Dev](https://browseai.dev).

## What it does

- Verifies legal and regulatory claims against authoritative sources
- Cross-references compliance requirements across jurisdictions
- Detects contradictions in evolving regulatory frameworks
- Ranks sources by domain authority (prioritizing government and legal sources)
- Uses `depth="thorough"` for multi-pass verification

## How to run

```bash
pip install browseaidev
export BROWSEAI_API_KEY=bai_xxx
python agent.py
```

Or pass a custom query:

```bash
python agent.py "SEC disclosure requirements for AI-driven trading systems"
```

## What it demonstrates

- **Thorough mode**: Cross-checks legal claims across multiple regulatory sources
- **Source authority**: Government and legal domains ranked higher
- **Contradiction detection**: Finds conflicting interpretations across jurisdictions
- **Claim verification**: Each regulatory requirement individually verified

## Example queries

```bash
python agent.py "GDPR requirements for AI-generated content"
python agent.py "SEC disclosure requirements for AI-driven trading systems"
python agent.py "California CCPA vs EU GDPR data subject rights comparison"
python agent.py "Patent eligibility for AI-generated inventions in the US"
```

## License

Apache 2.0 — part of the [BrowseAI Dev](https://github.com/BrowseAI-HQ/BrowseAI-Dev) project.
