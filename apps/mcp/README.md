# browseai-dev

**Reliable research infrastructure for AI agents.** The research layer your agents are missing.

MCP server with real-time web search, evidence extraction, and structured citations. Drop into Claude Desktop, Cursor, Windsurf, LangChain, CrewAI, or any agent pipeline.

## What it does

Instead of letting your AI hallucinate, `browseai-dev` gives it real-time access to the web with **structured, cited answers**:

```
Your question → Web search → Neural rerank → Fetch pages → Extract claims → Verify → Cited answer (streamed)
```

Every answer includes:
- **Claims** with source URLs, verification status, and consensus level
- **8-factor confidence score** (0-1) — evidence-based, not LLM self-assessed, auto-calibrated from feedback
- **Source quotes** verified against actual page text via hybrid BM25 + NLI matching
- **Atomic claim decomposition** — compound facts split and verified independently
- **Execution trace** with timing
- **3 depth modes** — `"fast"` (default), `"thorough"` (auto-retry with rephrased queries), `"deep"` (premium multi-step agentic research: iterative think-search-extract-evaluate cycles with gap analysis, up to 4 steps, targets 0.85 confidence — requires BAI key + sign-in, 3x quota cost, falls back to thorough when exhausted)

### Premium Features (with `BROWSE_API_KEY`)

Users with a BrowseAI Dev API key (`bai_xxx`) get enhanced verification:
- **Neural cross-encoder re-ranking** — search results re-scored by semantic query-document relevance
- **NLI semantic reranking** — evidence matched by meaning, not just keywords
- **Multi-provider search** — parallel search across multiple sources for broader coverage
- **Multi-pass consistency** — claims cross-checked across independent extraction passes
- **Deep reasoning mode** — multi-step agentic research with iterative think-search-extract-evaluate cycles, gap analysis, and cross-step claim merging (up to 4 steps, 3x quota cost, 100 deep queries/day)
- **Research Sessions** — persistent memory across queries

Free BAI key users get a generous daily quota (100 premium queries/day, or ~33 deep queries/day at 3x cost each). When exceeded, queries gracefully fall back to BM25 keyword verification (deep falls back to thorough). Quota resets every 24 hours.

**No account needed** — all tools work with BYOK (your own Tavily + OpenRouter keys) with no signup, no limits, and BM25 keyword verification. Sign in at [browseai.dev](https://browseai.dev) for a free BAI key to unlock premium features.

## Quick Start

```bash
npx browseai-dev setup
```

This auto-configures Claude Desktop. You'll need:
- [Tavily API key](https://tavily.com) (free tier available)
- [OpenRouter API key](https://openrouter.ai)

## Manual Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "browseai-dev": {
      "command": "npx",
      "args": ["-y", "browseai-dev"],
      "env": {
        "SERP_API_KEY": "tvly-your-key",
        "OPENROUTER_API_KEY": "your-openrouter-key",
        "BROWSE_API_KEY": "bai_xxx"
      }
    }
  }
}
```

> `BROWSE_API_KEY` is optional for search/answer but **required for Research Memory (sessions)**. Get one free at [browseai.dev/dashboard](https://browseai.dev/dashboard).

### Cursor / Windsurf

Add to your MCP settings:

```json
{
  "browseai-dev": {
    "command": "npx",
    "args": ["-y", "browseai-dev"],
    "env": {
      "SERP_API_KEY": "tvly-your-key",
      "OPENROUTER_API_KEY": "your-openrouter-key",
      "BROWSE_API_KEY": "bai_xxx"
    }
  }
}
```

> Add `BROWSE_API_KEY` to enable Research Memory (sessions). Get one free at [browseai.dev/dashboard](https://browseai.dev/dashboard).

### HTTP Transport

Run as an HTTP server for browser-based clients, Smithery, or any HTTP-capable agent:

```bash
# Start with HTTP transport
npx browseai-dev --http

# Or set the port via environment variable
MCP_HTTP_PORT=3100 npx browseai-dev --http
```

The server exposes:
- `POST /mcp` — MCP Streamable HTTP endpoint
- `GET /health` — Health check

### Docker

```bash
docker build -t browseai-dev ./apps/mcp
docker run -p 3100:3100 -e BROWSE_API_KEY=bai_xxx browseai-dev
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `browse_search` | Search the web via multi-provider search |
| `browse_open` | Fetch and parse a page into clean text |
| `browse_extract` | Extract structured knowledge from a page |
| `browse_answer` | Full pipeline: search + extract + cite. `depth`: `"fast"`, `"thorough"`, or `"deep"` |
| `browse_compare` | Compare raw LLM vs evidence-backed answer |
| `browse_clarity` | Clarity — anti-hallucination answer engine. Default: fast LLM answer with reduced hallucinations. `verify: true`: fuses LLM + web-verified results |
| `browse_session_create` | Create a research session (persistent memory across queries) |
| `browse_session_ask` | Research within a session (recalls prior knowledge, stores new claims) |
| `browse_session_recall` | Query session knowledge without new web searches |
| `browse_session_share` | Share a session publicly (returns share URL) |
| `browse_session_knowledge` | Export all claims from a session |
| `browse_session_fork` | Fork a shared session to continue the research |
| `browse_feedback` | Submit accuracy feedback on a result |

> **Note:** Session tools (`browse_session_*`) require a BrowseAI Dev API key (`bai_xxx`) for identity and ownership. Set `BROWSE_API_KEY` in your env config. BYOK users can use search/answer but cannot use sessions. Get a free API key at [browseai.dev/dashboard](https://browseai.dev/dashboard).

## Examples

**Quick lookup:**
> *"Use browse_answer to explain what causes aurora borealis"*

**Higher accuracy:**
> *"Use browse_answer with depth thorough to research quantum computing"*

**Deep research (multi-step, requires BAI key):**
> *"Use browse_answer with depth deep to compare CRISPR approaches for sickle cell disease"*
>
> Deep mode runs iterative think-search-extract-evaluate cycles: gap analysis identifies missing info, follow-up queries fill the gaps, and claims/sources are merged across steps with final re-verification. Targets 0.85 confidence across up to 4 steps. Falls back to thorough without a BAI key or when quota is exhausted.

**Contradiction detection:**
> *"Use browse_answer with depth thorough to check if coffee is good for health, and show me any contradictions"*

**Research session:**
> *"Create a session called quantum-research, then ask about quantum entanglement, then ask how entanglement is used in computing"*

**Enterprise search:**
> *"Use browse_answer to search our Elasticsearch at https://es.company.com/kb/_search for our refund policy"*

### Response structure

```json
{
  "answer": "Aurora borealis occurs when charged particles from the Sun...",
  "confidence": 0.92,
  "claims": [
    {
      "claim": "Aurora borealis is caused by solar wind particles...",
      "sources": ["https://en.wikipedia.org/wiki/Aurora"],
      "verified": true,
      "verificationScore": 0.82,
      "consensusLevel": "strong"
    }
  ],
  "sources": [
    {
      "url": "https://en.wikipedia.org/wiki/Aurora",
      "title": "Aurora - Wikipedia",
      "domain": "en.wikipedia.org",
      "quote": "An aurora is a natural light display...",
      "verified": true,
      "authority": 0.70
    }
  ],
  "contradictions": [],
  "reasoningSteps": []
}
```

## Why browseai-dev?

| Feature | Raw LLM | browseai-dev |
|---------|---------|-----------|
| Sources | None | Real URLs with quotes |
| Citations | Hallucinated | Verified from pages |
| Confidence | Unknown | 8-factor evidence-based score |
| Depth | Single pass | 3 modes: fast, thorough, deep reasoning |
| Freshness | Training data | Real-time web |
| Claims | Mixed in text | Structured + linked |

## Reliability

All API calls include automatic retry with exponential backoff on transient failures (429 rate limits, 5xx server errors). Auth errors fail immediately — no wasted retries.

## Tech Stack

- **Search**: Multi-provider (parallel search across sources)
- **Parsing**: @mozilla/readability + linkedom
- **AI**: OpenRouter (100+ models)
- **Verification**: Hybrid BM25 + NLI semantic entailment
- **Protocol**: Model Context Protocol (MCP)

## Agent Skills

Pre-built skills that teach coding agents when to use BrowseAI Dev tools:

```bash
npx skills add BrowseAI-HQ/browseAIDev_Skills
```

Skills work with Claude Code, Codex CLI, Gemini CLI, Cursor, and more. [View skills →](https://github.com/BrowseAI-HQ/browseAIDev_Skills)

## Community

- [Discord](https://discord.gg/ubAuT4YQsT)
- [GitHub](https://github.com/BrowseAI-HQ/BrowseAI-Dev)

## License

MIT
