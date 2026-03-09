# Browse AI

**The Anti-Hallucination Stack** — open-source deep research infrastructure for AI agents.

Turn any AI assistant into a research engine with real-time web search, evidence extraction, and structured citations.

## Why Browse AI?

AI agents hallucinate. They cite papers that don't exist, quote statistics they made up, and present fiction as fact. This costs businesses **$67.4B annually**.

Browse AI is the anti-hallucination stack — an open-source research engine that gives AI agents the ability to search the real web, extract evidence from real sources, and cite their work. Every claim is backed by a URL. Every answer has a confidence score.

Built by developers, for developers. Because better research means better products.

## How It Works

```
search → fetch pages → extract claims → build evidence graph → cited answer
```

Every answer goes through a 5-step verification pipeline. No hallucination. Every claim is backed by a real source.

## Quick Start

```sh
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Fill in: SERP_API_KEY, OPENROUTER_API_KEY

# Start API + frontend together
pnpm dev
```

### MCP Server (for Claude Desktop, Cursor, Windsurf)

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

## Project Structure

```
/apps/api          Fastify API server (port 3001)
/apps/mcp          MCP server (stdio transport, npm: browse-ai)
/packages/shared   Shared types, Zod schemas, constants
/src               React frontend (Vite, port 8080)
/scripts           Build & demo scripts
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /browse/search` | Search the web |
| `POST /browse/open` | Fetch and parse a page |
| `POST /browse/extract` | Extract structured claims from a page |
| `POST /browse/answer` | Full pipeline: search + extract + cite |
| `POST /browse/compare` | Compare raw LLM vs evidence-backed answer |
| `GET /browse/share/:id` | Get a shared result |
| `GET /browse/stats` | Total queries answered |

## MCP Tools

| Tool | Description |
|------|-------------|
| `browse_search` | Search the web for information on any topic |
| `browse_open` | Fetch and parse a web page into clean text |
| `browse_extract` | Extract structured claims from a page |
| `browse_answer` | Full pipeline: search + extract + cite |
| `browse_compare` | Compare raw LLM vs evidence-backed answer |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SERP_API_KEY` | Yes | Web search API key |
| `OPENROUTER_API_KEY` | Yes | LLM API key |
| `REDIS_URL` | No | Redis connection URL (falls back to in-memory cache) |
| `PORT` | No | API server port (default: 3001) |

## Where We're Going

- **Today**: Evidence-backed research with real-time web search and structured citations
- **Next**: Multi-source verification — cross-reference claims, consensus scoring
- **Then**: Broader knowledge — academic papers, code search, real-time data
- **Vision**: The trust layer for every AI agent — open source, community-driven

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and PR process.

## Tech Stack

- **API**: Node.js, TypeScript, Fastify, Zod
- **Search**: Web search API
- **Parsing**: @mozilla/readability + linkedom
- **AI**: LLM via API
- **Caching**: Redis (optional) / in-memory
- **Frontend**: React, Tailwind CSS, shadcn/ui
- **MCP**: @modelcontextprotocol/sdk
