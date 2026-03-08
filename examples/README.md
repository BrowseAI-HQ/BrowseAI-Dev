# BrowseAI Examples

Agent recipes showing how to use BrowseAI as the research layer for AI agents.

## Quick Start

```bash
pip install browseai
```

## Examples

| Example | Description |
|---------|-------------|
| [research-agent.py](research-agent.py) | Simple research agent with citations and confidence scores |
| [code-research-agent.py](code-research-agent.py) | Agent that researches libraries and docs before writing code |
| [hallucination-detector.py](hallucination-detector.py) | Compare raw LLM answers vs evidence-backed answers |
| [langchain-agent.py](langchain-agent.py) | Drop BrowseAI into a LangChain agent pipeline |
| [crewai-research-team.py](crewai-research-team.py) | Multi-agent research team with CrewAI + BrowseAI |

## How it works

```
Agent → BrowseAI → Internet → Verified answers + sources
```

BrowseAI is **reliable research infrastructure for AI agents** — every answer comes with real sources, confidence scores, and verified claims.

## Get API Key

- **Free**: Use BYOK (Bring Your Own Keys) with Tavily + OpenRouter
- **API Key**: Get a `bai_xxx` key at [browseai.dev](https://browseai.dev)

## Links

- [Documentation](https://browseai.dev/developers)
- [Discord](https://discord.gg/b5SPaGk2)
- [GitHub](https://github.com/EiffelHack/BrowserAI-Dev)
