# browse-ai

**Reliable research infrastructure for AI agents.** The research layer your agents are missing.

MCP server with real-time web search, evidence extraction, and structured citations. Drop into Claude Desktop, Cursor, Windsurf, LangChain, CrewAI, or any agent pipeline.

## What it does

Instead of letting your AI hallucinate, `browse-ai` gives it real-time access to the web with **structured, cited answers**:

```
Your question → Web search → Fetch pages → Extract claims → Build evidence graph → Cited answer
```

Every answer includes:
- **Claims** with source URLs, verification status, and consensus level
- **7-factor confidence score** (0-1) — evidence-based, not LLM self-assessed
- **Source quotes** verified against actual page text via BM25
- **Execution trace** with timing
- **Thorough mode** — pass `depth: "thorough"` to auto-retry with rephrased queries when confidence < 60%

## Quick Start

```bash
npx browse-ai setup
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
    "browse-ai": {
      "command": "npx",
      "args": ["-y", "browse-ai"],
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
  "browse-ai": {
    "command": "npx",
    "args": ["-y", "browse-ai"],
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
npx browse-ai --http

# Or set the port via environment variable
MCP_HTTP_PORT=3100 npx browse-ai --http
```

The server exposes:
- `POST /mcp` — MCP Streamable HTTP endpoint
- `GET /health` — Health check

### Docker

```bash
docker build -t browse-ai ./apps/mcp
docker run -p 3100:3100 -e BROWSE_API_KEY=bai_xxx browse-ai
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `browse_search` | Search the web via Tavily |
| `browse_open` | Fetch and parse a page into clean text |
| `browse_extract` | Extract structured knowledge from a page |
| `browse_answer` | Full pipeline: search + extract + cite. Supports `depth: "thorough"` for auto-retry |
| `browse_compare` | Compare raw LLM vs evidence-backed answer |
| `browse_session_create` | Create a research session (persistent memory across queries) |
| `browse_session_ask` | Research within a session (recalls prior knowledge, stores new claims) |
| `browse_session_recall` | Query session knowledge without new web searches |
| `browse_session_share` | Share a session publicly (returns share URL) |
| `browse_session_knowledge` | Export all claims from a session |
| `browse_session_fork` | Fork a shared session to continue the research |

> **Note:** Session tools (`browse_session_*`) require a BrowseAI API key (`bai_xxx`) for identity and ownership. Set `BROWSE_API_KEY` in your env config. BYOK (Tavily + OpenRouter keys only) works for search/answer but cannot use sessions. Get a free API key at [browseai.dev/dashboard](https://browseai.dev/dashboard).

## Example

Ask Claude: *"Use browse_answer to explain what causes aurora borealis"*

For higher accuracy: *"Use browse_answer with depth thorough to research quantum computing"*

Response:
```json
{
  "answer": "Aurora borealis occurs when charged particles from the Sun...",
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
  "confidence": 0.92
}
```

## Why browse-ai?

| Feature | Raw LLM | browse-ai |
|---------|---------|-----------|
| Sources | None | Real URLs with quotes |
| Citations | Hallucinated | Verified from pages |
| Confidence | Unknown | 7-factor evidence-based score |
| Depth | Single pass | Thorough mode with auto-retry |
| Freshness | Training data | Real-time web |
| Claims | Mixed in text | Structured + linked |

## Reliability

All API calls include automatic retry with exponential backoff on transient failures (429 rate limits, 5xx server errors). Auth errors fail immediately — no wasted retries.

## Tech Stack

- **Search**: Tavily API
- **Parsing**: @mozilla/readability + linkedom
- **AI**: OpenRouter (100+ models)
- **Protocol**: Model Context Protocol (MCP)

## Community

- [Discord](https://discord.gg/ubAuT4YQsT)
- [GitHub](https://github.com/BrowseAI-HQ/BrowseAI-Dev)

## License

MIT
