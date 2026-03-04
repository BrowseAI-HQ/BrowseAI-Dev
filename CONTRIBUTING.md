# Contributing to Browse AI

Thanks for your interest in contributing! Browse AI is an open-source deep research engine for AI agents.

## Quick Setup

```bash
git clone https://github.com/EiffelHack/ai-agent-browser.git
cd ai-agent-browser
pnpm install
cp .env.example .env
# Add your API keys to .env
pnpm dev
```

You need two free API keys:
- **Tavily** (web search): https://app.tavily.com
- **Gemini** (LLM): https://aistudio.google.com/apikey

## Project Structure

```
ai-agent-browser/
├── src/                    # Frontend (React + Vite)
│   ├── components/         # UI components
│   ├── pages/              # Route pages
│   └── lib/api/            # API client
├── apps/
│   ├── api/                # Fastify REST API server
│   │   ├── src/routes/     # API endpoints
│   │   ├── src/services/   # Business logic
│   │   └── src/config/     # Environment config
│   └── mcp/                # MCP server for AI assistants
├── packages/
│   └── shared/             # Shared types and constants
└── package.json            # Root workspace config
```

## Architecture

1. **Frontend** (`src/`) — React landing page + playground UI
2. **API** (`apps/api/`) — Fastify server with 5 endpoints: search, open, extract, answer, compare
3. **MCP** (`apps/mcp/`) — Model Context Protocol server for Claude Desktop, Cursor, etc.
4. **Shared** (`packages/shared/`) — TypeScript types, Zod schemas, constants

### Data Flow

```
Query → Tavily Search → Fetch Pages → Readability Parse → Gemini Extract → Structured Citations
```

## Adding a New Tool/Endpoint

1. Add the Zod schema in `packages/shared/src/schemas.ts`
2. Add the service logic in `apps/api/src/services/`
3. Register the route in `apps/api/src/routes/browse.ts`
4. Add the MCP tool in `apps/mcp/src/tools/`
5. Add the frontend API call in `src/lib/api/browse.ts`

## Coding Conventions

- TypeScript everywhere
- Zod for request validation
- Fastify for the API server
- No `any` types unless absolutely necessary
- Use the shared package for types used across apps

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes
3. Run `pnpm build:all` to verify everything compiles
4. Open a PR with a clear description of what and why

## Reporting Issues

Use GitHub Issues. Include:
- What you expected
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, etc.)
