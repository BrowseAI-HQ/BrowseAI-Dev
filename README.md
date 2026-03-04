# AI Agent Browser

Perfect Browsing Infrastructure for AI Agents — convert web pages into structured knowledge with claims, evidence, sources, and confidence scores.

## Architecture

```
search (Tavily) → fetch pages (Readability) → extract claims (OpenRouter LLM) → build evidence graph → structured answer
```

## Project Structure

```
/apps/api          Fastify API server (port 3001)
/apps/mcp          MCP server (stdio transport)
/packages/shared   Shared types, Zod schemas, constants
/src               React frontend (Vite, port 8080)
/scripts           Demo scripts
```

## Quick Start

```sh
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Fill in: SERP_API_KEY, OPENROUTER_API_KEY, REDIS_URL (optional)

# Start API + frontend together
pnpm dev

# Or start individually
pnpm dev:api   # Fastify on :3001
pnpm dev:web   # Vite on :8080
pnpm dev:mcp   # MCP server (stdio)
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /browse/search` | Search the web via Tavily |
| `POST /browse/open` | Fetch and parse a page via Readability |
| `POST /browse/extract` | Extract structured knowledge from a page |
| `POST /browse/answer` | Full pipeline: search → fetch → extract → answer |

## MCP Tools

- `browse.search` — Search the web
- `browse.open` — Fetch and parse a page
- `browse.extract` — Extract knowledge from a page
- `browse.answer` — Full pipeline with structured answer

## Demo

```sh
pnpm demo "Explain wormholes with evidence"
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SERP_API_KEY` | Yes | Tavily API key |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `REDIS_URL` | No | Redis connection URL (falls back to in-memory cache) |
| `PORT` | No | API server port (default: 3001) |

## Tech Stack

- **API**: Node.js, TypeScript, Fastify, Zod
- **Search**: Tavily API
- **Parsing**: @mozilla/readability + linkedom
- **AI**: OpenRouter (100+ models)
- **Caching**: Redis (optional) / in-memory
- **Frontend**: React, Tailwind CSS, shadcn/ui
- **MCP**: @modelcontextprotocol/sdk
