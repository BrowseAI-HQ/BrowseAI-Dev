# BrowseAI Dev Examples

Agent recipes and tutorials showing how to use BrowseAI Dev as the research layer for AI agents.

## Quick Start

```bash
pip install browseaidev
```

## Agent Recipes

Quick single-file examples to get started fast.

| Example | Description |
|---------|-------------|
| [research-agent.py](research-agent.py) | Simple research agent with citations and confidence scores |
| [deep-research-agent.py](deep-research-agent.py) | Multi-step deep reasoning with gap analysis and reasoning steps |
| [streaming-agent.py](streaming-agent.py) | Real-time SSE streaming — trace steps, sources, answer tokens |
| [contradiction-detector.py](contradiction-detector.py) | Surface contradictions across sources on controversial topics |
| [enterprise-search.py](enterprise-search.py) | Custom data sources (Elasticsearch, Confluence) + zero retention |
| [code-research-agent.py](code-research-agent.py) | Agent that researches libraries and docs before writing code |
| [hallucination-detector.py](hallucination-detector.py) | Compare raw LLM answers vs evidence-backed answers |
| [langchain-agent.py](langchain-agent.py) | Drop BrowseAI Dev into a LangChain agent pipeline |
| [crewai-research-team.py](crewai-research-team.py) | Multi-agent research team with CrewAI + BrowseAI Dev |
| [llamaindex-agent.py](llamaindex-agent.py) | ReAct agent with LlamaIndex + BrowseAI Dev verified research |
| [research-session.py](research-session.py) | Multi-turn research with persistent knowledge across queries |

## Tutorials

Full project tutorials — each with its own README, working code, and setup instructions.

| Tutorial | What You'll Build | Features Used |
|----------|-------------------|---------------|
| [coding-agent/](coding-agent/) | Agent that researches before writing code — never recommends deprecated libraries | Ask (thorough), Code Research |
| [support-agent/](support-agent/) | Agent that verifies answers before responding — escalates when confidence is low | Ask (fast), Confidence Thresholds |
| [content-agent/](content-agent/) | Agent that writes blog posts where every stat has a citation and confidence score | Ask (thorough), Citations, Writing |
| [fact-checker-bot/](fact-checker-bot/) | Discord bot that verifies any claim with `!verify` and `!compare` | Ask (thorough), Compare, AsyncBrowseAIDev |
| [is-this-true/](is-this-true/) | Web app — paste any sentence, get a confidence score and sources | Ask, Streaming, FastAPI |
| [debate-settler/](debate-settler/) | CLI tool — two claims battle it out, evidence decides the winner | Ask (thorough), Contradictions |
| [docs-verifier/](docs-verifier/) | Verify every factual claim in your README or docs | Ask, Open, Extract |
| [podcast-prep/](podcast-prep/) | Research brief builder for podcast interviews | Sessions, Recall, Knowledge Export |

## How it works

```
Agent → BrowseAI Dev → Internet / Enterprise Data → Verified answers + sources
```

BrowseAI Dev is **research infrastructure for AI agents** — every answer comes with real sources, confidence scores, and verified claims. Works with internet search out of the box, or plug in enterprise data sources (Elasticsearch, Confluence, custom endpoints).

## Get API Key

- **Free**: Get a BAI key at [browseai.dev](https://browseai.dev)

## Links

- [Documentation](https://browseai.dev/developers)
- [Discord](https://discord.gg/ubAuT4YQsT)
- [GitHub](https://github.com/BrowseAI-HQ/BrowseAI-Dev)
