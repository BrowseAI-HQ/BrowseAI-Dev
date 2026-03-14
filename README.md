# BrowseAI Dev

[![npm](https://img.shields.io/npm/v/browse-ai)](https://www.npmjs.com/package/browse-ai)
[![PyPI](https://img.shields.io/pypi/v/browseai)](https://pypi.org/project/browseai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/ubAuT4YQsT)

**Research infrastructure for AI agents** — real-time web search, evidence extraction, and structured citations. Every claim is backed by a URL. Every answer has a confidence score.

```
Agent → BrowseAI Dev → Internet → Verified answers + sources
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

### Research Memory (Sessions)

Persistent research sessions that accumulate knowledge across multiple queries. Later queries automatically recall prior verified claims, building deeper understanding over time.

> **Sessions require a BrowseAI Dev API key (`bai_xxx`)** for identity and ownership. BYOK (Tavily + OpenRouter keys only) works for search/answer but cannot use sessions. Get a free key at [browseai.dev/dashboard](https://browseai.dev/dashboard). For MCP, set `BROWSE_API_KEY` env var. For Python SDK, pass `api_key="bai_xxx"`. For REST API, use `Authorization: Bearer bai_xxx`.

```python
# Python SDK
session = client.session("quantum-research")
r1 = session.ask("What is quantum entanglement?")       # 13 claims stored
r2 = session.ask("How is entanglement used in computing?")  # 12 claims recalled!
knowledge = session.knowledge()  # Export all accumulated claims

# Share with other agents or humans
share = session.share()  # Returns shareId + URL
# Another agent forks and continues the research
forked = client.fork_session(share.share_id)
```

```bash
# REST API
curl -X POST https://browseai.dev/api/session \
  -H "Authorization: Bearer bai_xxx" \
  -d '{"name": "my-research"}'
# Returns session ID, then:
curl -X POST https://browseai.dev/api/session/{id}/ask \
  -H "Authorization: Bearer bai_xxx" \
  -d '{"query": "What is quantum entanglement?"}'

# Share a session publicly
curl -X POST https://browseai.dev/api/session/{id}/share \
  -H "Authorization: Bearer bai_xxx"

# Fork a shared session (copies all knowledge)
curl -X POST https://browseai.dev/api/session/share/{shareId}/fork \
  -H "Authorization: Bearer bai_xxx"
```

Each session response includes `recalledClaims` and `newClaimsStored`. Sessions can be shared publicly and forked by other agents — enabling collaborative, multi-agent research workflows.

### Query Planning

Complex queries are automatically decomposed into focused sub-queries with intent labels (definition, evidence, comparison, counterargument, technical, historical). Each sub-query targets a different aspect of the question, maximizing source diversity. Simple factual queries skip planning entirely — no added latency.

### Self-Improving Accuracy

The entire verification pipeline improves automatically with usage:

- **Domain authority** — Bayesian cold-start smoothing adjusts domain trust scores as evidence accumulates. Static tier scores dominate initially, then real verification rates take over.
- **Adaptive BM25 thresholds** — Claim verification thresholds tune per query type based on observed verification rates. Too strict? Loosens up. Too lenient? Tightens.
- **Consensus threshold tuning** — Cross-source agreement thresholds adapt based on query type performance.
- **Confidence weight optimization** — The 7-factor confidence formula rebalances weights per query type when user feedback indicates inaccuracy.
- **Page count optimization** — Source fetch counts adjust based on confidence outcomes per query type.

### Feedback Loop

Submit feedback on results to accelerate learning. Agents and users can rate results as `good`, `bad`, or `wrong` — this feeds directly into the adaptive threshold engine.

```bash
curl -X POST https://browseai.dev/api/browse/feedback \
  -H "Content-Type: application/json" \
  -d '{"resultId": "abc123", "rating": "good"}'
```

```python
client.feedback(result_id="abc123", rating="good")
# Or flag a specific wrong claim:
client.feedback(result_id="abc123", rating="wrong", claim_index=2)
```

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
        "OPENROUTER_API_KEY": "your-llm-key",
        "BROWSE_API_KEY": "bai_xxx"
      }
    }
  }
}
```

> `BROWSE_API_KEY` is optional for search/answer but required for Research Memory (sessions).

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

# With a BrowseAI Dev API key
curl -X POST https://browseai.dev/api/browse/answer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bai_xxx" \
  -d '{"query": "What is quantum computing?"}'
```

### Self-Host

```sh
git clone https://github.com/BrowseAI-HQ/BrowseAI-Dev.git
cd BrowseAI-Dev
pnpm install
cp .env.example .env
# Fill in: SERP_API_KEY, OPENROUTER_API_KEY
pnpm dev
```

## API Keys

Three ways to authenticate:

| Method | How | Limits |
|--------|-----|--------|
| **BYOK** (recommended) | Pass `X-Tavily-Key` and `X-OpenRouter-Key` headers | Unlimited, free (search/answer only — no sessions) |
| **BrowseAI Dev API Key** | Pass `Authorization: Bearer bai_xxx` | Unlimited + sessions, sharing, forking |
| **Demo** | No auth needed | 5 queries/hour per IP |

Get a BrowseAI Dev API key from the [dashboard](https://browseai.dev/dashboard) — it bundles your Tavily + OpenRouter keys into one key for CLI, MCP, and API use.

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
| `POST /session` | Create a research session |
| `POST /session/:id/ask` | Research with session memory (recalls + stores claims) |
| `POST /session/:id/recall` | Query session knowledge without new search |
| `GET /session/:id/knowledge` | Export all session claims |
| `POST /session/:id/share` | Share a session publicly (returns shareId) |
| `GET /session/share/:shareId` | View a shared session (public, no auth) |
| `POST /session/share/:shareId/fork` | Fork a shared session into your account |
| `GET /session/:id` | Get session details |
| `GET /sessions` | List your sessions (authenticated) |
| `DELETE /session/:id` | Delete a session (authenticated) |
| `POST /browse/feedback` | Submit feedback on a result (good/bad/wrong) |
| `GET /browse/learning/stats` | Self-learning engine stats |
| `GET /user/stats` | Your query stats (authenticated) |
| `GET /user/history` | Your query history (authenticated) |

## MCP Tools

| Tool | Description |
|------|-------------|
| `browse_search` | Search the web for information on any topic |
| `browse_open` | Fetch and parse a web page into clean text |
| `browse_extract` | Extract structured claims from a page |
| `browse_answer` | Full pipeline: search + extract + cite. Supports `depth: "thorough"` |
| `browse_compare` | Compare raw LLM vs evidence-backed answer |
| `browse_session_create` | Create a research session (persistent memory) |
| `browse_session_ask` | Research within a session (recalls prior knowledge) |
| `browse_session_recall` | Query session knowledge without new web search |
| `browse_session_share` | Share a session publicly (returns share URL) |
| `browse_session_knowledge` | Export all claims from a session |
| `browse_session_fork` | Fork a shared session to continue the research |
| `browse_feedback` | Submit feedback on a result to improve accuracy |

## Python SDK

| Method | Description |
|--------|-------------|
| `client.search(query)` | Search the web |
| `client.open(url)` | Fetch and parse a page |
| `client.extract(url, query=)` | Extract claims from a page |
| `client.ask(query, depth=)` | Full pipeline with citations. `depth="thorough"` for auto-retry |
| `client.compare(query)` | Raw LLM vs evidence-backed |
| `client.session(name)` | Create a research session |
| `session.ask(query, depth=)` | Research with memory recall |
| `session.recall(query)` | Query session knowledge |
| `session.knowledge()` | Export all session claims |
| `session.share()` | Share session publicly (returns shareId + URL) |
| `client.get_session(id)` | Resume an existing session by ID |
| `client.list_sessions()` | List all your sessions |
| `client.fork_session(share_id)` | Fork a shared session into your account |
| `session.delete()` | Delete a session |
| `client.feedback(result_id, rating)` | Submit feedback (good/bad/wrong) to improve accuracy |

Async support: `AsyncBrowseAI` with the same API.

## Examples

See the [examples/](examples/) directory for ready-to-run agent recipes:

| Example | Description |
|---------|-------------|
| [research-agent.py](examples/research-agent.py) | Simple research agent with citations |
| [code-research-agent.py](examples/code-research-agent.py) | Research libraries/docs before writing code |
| [hallucination-detector.py](examples/hallucination-detector.py) | Compare raw LLM vs evidence-backed answers |
| [langchain-agent.py](examples/langchain-agent.py) | BrowseAI Dev as a LangChain tool |
| [crewai-research-team.py](examples/crewai-research-team.py) | Multi-agent research team with CrewAI |
| [research-session.py](examples/research-session.py) | Research sessions with persistent memory |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SERP_API_KEY` | Yes | Web search API key ([Tavily](https://app.tavily.com)) |
| `OPENROUTER_API_KEY` | Yes | LLM API key ([OpenRouter](https://openrouter.ai/keys)) |
| `KV_REST_API_URL` | No | Vercel KV / Upstash Redis REST URL (falls back to in-memory cache) |
| `KV_REST_API_TOKEN` | No | Vercel KV / Upstash Redis REST token |
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

## Agent Skills

Pre-built skills that teach AI coding agents (Claude Code, Codex, Cursor, etc.) when and how to use BrowseAI Dev:

```bash
npx skills add BrowseAI-HQ/browseAIDev_Skills
```

| Skill | What it does |
|-------|-------------|
| [browse-research](https://github.com/BrowseAI-HQ/browseAIDev_Skills/tree/main/browse-research) | Evidence-backed answers with citations and confidence |
| [browse-fact-check](https://github.com/BrowseAI-HQ/browseAIDev_Skills/tree/main/browse-fact-check) | Compare raw LLM vs evidence-backed, verify claims |
| [browse-extract](https://github.com/BrowseAI-HQ/browseAIDev_Skills/tree/main/browse-extract) | Structured claim extraction from URLs |
| [browse-sessions](https://github.com/BrowseAI-HQ/browseAIDev_Skills/tree/main/browse-sessions) | Multi-query research with persistent knowledge |

[View all skills →](https://github.com/BrowseAI-HQ/browseAIDev_Skills)

## Community

- [Discord](https://discord.gg/ubAuT4YQsT) — questions, feedback, showcase
- [GitHub Issues](https://github.com/BrowseAI-HQ/BrowseAI-Dev/issues) — bugs, feature requests

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and PR process.

## License

[MIT](LICENSE)
