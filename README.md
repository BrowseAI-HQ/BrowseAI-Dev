# BrowseAI Dev

[![npm](https://img.shields.io/npm/v/browse-ai)](https://www.npmjs.com/package/browse-ai)
[![PyPI](https://img.shields.io/pypi/v/browseai)](https://pypi.org/project/browseai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/ubAuT4YQsT)

**Reliable research infrastructure for AI agents** — real-time web search, evidence extraction, and structured citations. Every claim is backed by a URL. Every answer has a confidence score.

```
Agent → BrowseAI → Internet → Verified answers + sources
```

[Website](https://browseai.dev) · [Playground](https://browseai.dev/playground) · [API Docs](https://browseai.dev/developers) · [Discord](https://discord.gg/ubAuT4YQsT)

---

## How It Works

```
search → fetch pages → extract claims → build evidence graph → cited answer
```

Every answer goes through a 6-step verification pipeline. No hallucination. Every claim is backed by a real source.

### Verification & Confidence Scoring

Confidence scores are **evidence-based** — not LLM self-assessed. After the LLM extracts claims and sources, a post-extraction verification engine checks every claim against the actual source page text:

1. **BM25 sentence matching** — Each claim is scored against every sentence in its cited sources using [BM25](https://en.wikipedia.org/wiki/Okapi_BM25) (the ranking algorithm behind Elasticsearch and Lucene). This catches paraphrased claims that simple keyword overlap would miss.
2. **Domain authority scoring** — 10,000+ domains across 5 tiers (institutional `.gov`/`.edu` → major news → tech journalism → community → low-quality), stored in Supabase with Majestic Million bulk import. Scores self-improve over time using Bayesian cold-start smoothing — every query feeds back verification data to make future scores more accurate.
3. **Source quote verification** — LLM-extracted quotes are verified against actual page text using hybrid matching (exact substring → BM25 fallback).
4. **Cross-source consensus** — Each claim is verified against *all* available page texts (not just cited sources). Claims supported by 3+ independent domains get "strong consensus", boosting confidence. Single-source claims are flagged as "weak".
5. **Contradiction detection** — Claim pairs are analyzed for semantic conflicts using topic overlap + negation asymmetry. Detected contradictions are surfaced in the response and penalize the confidence score.
6. **7-factor confidence formula** — Final score combines: verification rate (25%), domain authority (20%), source count (15%), consensus (15%), domain diversity (10%), claim grounding (10%), and citation depth (5%). Each detected contradiction subtracts 0.05 from the raw score.

Claims include `verified`, `verificationScore`, `consensusCount`, and `consensusLevel` fields. Sources include `verified` and `authority`. Detected `contradictions` are returned at the top level. Agents can use these fields to make trust decisions programmatically.

### Thorough Mode

Pass `depth: "thorough"` to automatically retry with a rephrased query when first-pass confidence is below 60%. The system searches again with alternative terms, merges sources from both passes, and picks the higher-confidence result.

```bash
curl -X POST https://browseai.dev/api/browse/answer \
  -H "Content-Type: application/json" \
  -H "X-Tavily-Key: tvly-xxx" \
  -H "X-OpenRouter-Key: sk-or-xxx" \
  -d '{"query": "What is quantum computing?", "depth": "thorough"}'
```

### Streaming API

Get real-time progress instead of waiting for the full response. The streaming endpoint sends Server-Sent Events (SSE) as each pipeline step completes:

```bash
curl -N -X POST https://browseai.dev/api/browse/answer/stream \
  -H "Content-Type: application/json" \
  -H "X-Tavily-Key: tvly-xxx" \
  -H "X-OpenRouter-Key: sk-or-xxx" \
  -d '{"query": "What is quantum computing?"}'
```

Events: `trace` (progress), `sources` (discovered early), `result` (final answer), `done`.

### Retry with Backoff

All external API calls (Tavily search, OpenRouter LLM, Brave search, page fetching) automatically retry on transient failures (429 rate limits, 5xx server errors) with exponential backoff and jitter. Auth errors (401/403) fail immediately — no wasted retries.

### Self-Improving Accuracy

Domain authority scores improve automatically over time. Every query feeds verification data back into the system using Bayesian cold-start smoothing — static scores dominate initially, but as evidence accumulates, real verification rates gradually take over. The more your agents use BrowseAI, the more accurate future results become.

## Quick Start

### Python SDK

```bash
pip install browseai
```

```python
from browseai import BrowseAI

client = BrowseAI(api_key="bai_xxx")

# Research with citations
result = client.ask("What is quantum computing?")
print(result.answer)
print(f"Confidence: {result.confidence:.0%}")
for source in result.sources:
    print(f"  - {source.title}: {source.url}")

# Thorough mode — auto-retries if confidence < 60%
deep = client.ask("What is quantum computing?", depth="thorough")
```

**Framework integrations:**

```bash
pip install browseai[langchain]   # LangChain tools
pip install browseai[crewai]      # CrewAI integration
```

```python
# LangChain
from browseai.integrations.langchain import BrowseAIAskTool
tools = [BrowseAIAskTool(api_key="bai_xxx")]

# CrewAI
from browseai.integrations.crewai import BrowseAITool
researcher = Agent(tools=[BrowseAITool(api_key="bai_xxx")])
```

### MCP Server (Claude Desktop, Cursor, Windsurf)

```sh
npx browse-ai setup
```

Or manually add to your MCP config:

```json
{
  "mcpServers": {
    "browse-ai": {
      "command": "npx",
      "args": ["-y", "browse-ai"],
      "env": {
        "SERP_API_KEY": "your-search-key",
        "OPENROUTER_API_KEY": "your-llm-key"
      }
    }
  }
}
```

### REST API

```bash
# With your own keys (BYOK — free, no limits)
curl -X POST https://browseai.dev/api/browse/answer \
  -H "Content-Type: application/json" \
  -H "X-Tavily-Key: tvly-xxx" \
  -H "X-OpenRouter-Key: sk-or-xxx" \
  -d '{"query": "What is quantum computing?"}'

# Thorough mode (auto-retries if confidence < 60%)
curl -X POST https://browseai.dev/api/browse/answer \
  -H "Content-Type: application/json" \
  -H "X-Tavily-Key: tvly-xxx" \
  -H "X-OpenRouter-Key: sk-or-xxx" \
  -d '{"query": "What is quantum computing?", "depth": "thorough"}'

# With a BrowseAI API key
curl -X POST https://browseai.dev/api/browse/answer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bai_xxx" \
  -d '{"query": "What is quantum computing?"}'
```

### Self-Host

```sh
git clone https://github.com/BrowseAI-HQ/BrowserAI-Dev.git
cd BrowserAI-Dev
pnpm install
cp .env.example .env
# Fill in: SERP_API_KEY, OPENROUTER_API_KEY
pnpm dev
```

## API Keys

Three ways to authenticate:

| Method | How | Limits |
|--------|-----|--------|
| **BYOK** (recommended) | Pass `X-Tavily-Key` and `X-OpenRouter-Key` headers | Unlimited, free |
| **BrowseAI API Key** | Pass `Authorization: Bearer bai_xxx` | Unlimited (uses your stored keys) |
| **Demo** | No auth needed | 5 queries/hour per IP |

Get a BrowseAI API key from the [dashboard](https://browseai.dev/dashboard) — it bundles your Tavily + OpenRouter keys into one key for CLI, MCP, and API use.

## Project Structure

```
/apps/api              Fastify API server (port 3001)
/apps/mcp              MCP server (stdio transport, npm: browse-ai)
/packages/shared       Shared types, Zod schemas, constants
/packages/python-sdk   Python SDK (PyPI: browseai)
/src                   React frontend (Vite, port 8080)
/supabase              Database migrations
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /browse/search` | Search the web |
| `POST /browse/open` | Fetch and parse a page |
| `POST /browse/extract` | Extract structured claims from a page |
| `POST /browse/answer` | Full pipeline: search + extract + cite. Pass `depth: "thorough"` for auto-retry |
| `POST /browse/answer/stream` | Streaming answer via SSE — real-time progress events |
| `POST /browse/compare` | Compare raw LLM vs evidence-backed answer |
| `GET /browse/share/:id` | Get a shared result |
| `GET /browse/stats` | Total queries answered |
| `GET /browse/sources/top` | Top cited source domains |
| `GET /browse/analytics/summary` | Usage analytics (authenticated) |

## MCP Tools

| Tool | Description |
|------|-------------|
| `browse_search` | Search the web for information on any topic |
| `browse_open` | Fetch and parse a web page into clean text |
| `browse_extract` | Extract structured claims from a page |
| `browse_answer` | Full pipeline: search + extract + cite. Supports `depth: "thorough"` |
| `browse_compare` | Compare raw LLM vs evidence-backed answer |

## Python SDK

| Method | Description |
|--------|-------------|
| `client.search(query)` | Search the web |
| `client.open(url)` | Fetch and parse a page |
| `client.extract(url, query=)` | Extract claims from a page |
| `client.ask(query, depth=)` | Full pipeline with citations. `depth="thorough"` for auto-retry |
| `client.compare(query)` | Raw LLM vs evidence-backed |

Async support: `AsyncBrowseAI` with the same API.

## Examples

See the [examples/](examples/) directory for ready-to-run agent recipes:

| Example | Description |
|---------|-------------|
| [research-agent.py](examples/research-agent.py) | Simple research agent with citations |
| [code-research-agent.py](examples/code-research-agent.py) | Research libraries/docs before writing code |
| [hallucination-detector.py](examples/hallucination-detector.py) | Compare raw LLM vs evidence-backed answers |
| [langchain-agent.py](examples/langchain-agent.py) | BrowseAI as a LangChain tool |
| [crewai-research-team.py](examples/crewai-research-team.py) | Multi-agent research team with CrewAI |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SERP_API_KEY` | Yes | Web search API key ([Tavily](https://app.tavily.com)) |
| `OPENROUTER_API_KEY` | Yes | LLM API key ([OpenRouter](https://openrouter.ai/keys)) |
| `REDIS_URL` | No | Redis URL (falls back to in-memory cache) |
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key |
| `PORT` | No | API server port (default: 3001) |

## Tech Stack

- **API**: Node.js, TypeScript, Fastify, Zod
- **Search**: Tavily API
- **Parsing**: @mozilla/readability + linkedom
- **AI**: Gemini 2.5 Flash via OpenRouter
- **Caching**: Redis or in-memory with intelligent TTL (time-sensitive queries get shorter TTL)
- **Frontend**: React, Tailwind CSS, shadcn/ui, Framer Motion
- **MCP**: @modelcontextprotocol/sdk
- **Python SDK**: httpx, Pydantic
- **Database**: Supabase (PostgreSQL)

## Community

- [Discord](https://discord.gg/ubAuT4YQsT) — questions, feedback, showcase
- [GitHub Issues](https://github.com/BrowseAI-HQ/BrowserAI-Dev/issues) — bugs, feature requests

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and PR process.

## License

[MIT](LICENSE)
