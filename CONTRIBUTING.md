# Contributing to BrowseAI Dev

Thanks for your interest in contributing! BrowseAI Dev is reliable research infrastructure for AI agents.

## Quick Setup

```bash
git clone https://github.com/BrowseAI-HQ/BrowseAI-Dev.git
cd BrowseAI-Dev
pnpm install
cp .env.example .env
# Add your own API keys to .env
pnpm dev
```

### Required API Keys (free)
- **Tavily** (web search): https://app.tavily.com
- **OpenRouter** (LLM): https://openrouter.ai

## Project Structure

```
BrowseAI-Dev/
  src/                    # Frontend (React + Vite + shadcn/ui)
    components/           # UI components
    pages/                # Route pages
    lib/api/              # API client
  apps/
    api/                  # Fastify REST API server
      src/routes/         # API endpoints
      src/services/       # Business logic
      src/config/         # Environment config
    mcp/                  # MCP server (npm: browse-ai)
  packages/
    shared/               # Shared types, schemas, constants
    python-sdk/           # Python SDK (PyPI: browseai)
  supabase/
    migrations/           # Database migrations (timestamp format)
    functions/            # Supabase Edge Functions
  scripts/                # Build & deploy scripts
  .github/workflows/      # CI/CD pipelines
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start frontend + API in parallel |
| `pnpm dev:web` | Frontend only (Vite) |
| `pnpm dev:api` | API only (Fastify) |
| `pnpm dev:mcp` | MCP server only |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint with ESLint |
| `pnpm build:all` | Build everything |
| `pnpm --filter @browse/api exec tsc --noEmit` | Type check API |
| `pnpm --filter browse-ai exec tsc --noEmit` | Type check MCP |

## Contribution Rules

### Branch Policy
- **`main` is protected** — no direct pushes
- All changes must go through a **Pull Request**
- PRs require at least **1 maintainer approval** before merge
- CI checks (lint, type check, build, test) must pass before merge

### Pull Request Process
1. **Fork** the repo and create a branch from `main`
2. Use branch naming: `feat/...`, `fix/...`, `docs/...`, `refactor/...`
3. **One feature per PR** — keep changes focused
4. Run checks before submitting:
   ```bash
   pnpm lint
   pnpm test
   pnpm --filter @browse/shared build
   pnpm --filter @browse/api exec tsc --noEmit
   pnpm --filter browse-ai exec tsc --noEmit
   ```
5. Write a clear PR description — what changed and why
6. Wait for maintainer review — changes may be requested

### Code Conventions
- TypeScript everywhere — no `any` unless unavoidable
- Zod for all request/response validation
- Fastify for API routes
- shadcn/ui for frontend components
- Use the `packages/shared` package for types shared across apps
- Keep functions small and focused

### What NOT to Commit
- `.env` files — use `.env.example` as reference
- API keys, tokens, or secrets of any kind
- `node_modules/`, `dist/`, `.vercel/`
- Large binary files

## Areas to Contribute

### Good First Issues
- UI improvements and bug fixes in `src/components/`
- Add loading states or error boundaries
- Improve mobile responsiveness
- Add unit tests for existing services

### Frontend (React + Vite)
- Components and pages in `src/`
- Uses shadcn/ui, Tailwind CSS, Framer Motion
- State management with React Query

### Backend API (Fastify)
- Routes and services in `apps/api/src/`
- Search, extraction, and analysis pipelines
- Rate limiting, caching, API key management

### MCP Server
- Tool implementations in `apps/mcp/src/`
- Published to npm as `browse-ai`
- Works with Claude Desktop, Cursor, Windsurf

### Python SDK
- Client and models in `packages/python-sdk/browseai/`
- LangChain integration in `packages/python-sdk/browseai/integrations/langchain.py`
- CrewAI integration in `packages/python-sdk/browseai/integrations/crewai.py`
- Published to PyPI as `browseai`

### Research & Prompts
- Improve LLM prompts for better extraction
- Add new research strategies
- Improve citation and evidence quality

## Adding a New API Endpoint

1. Add Zod schema in `packages/shared/src/schemas.ts`
2. Add TypeScript type in `packages/shared/src/types.ts`
3. Export from `packages/shared/src/index.ts`
4. Build shared: `pnpm --filter @browse/shared build`
5. Add service logic in `apps/api/src/services/`
6. Register route in `apps/api/src/routes/browse.ts`
7. Add frontend API call in `src/lib/api/browse.ts`

## Adding a New MCP Tool

1. Open `apps/mcp/src/index.ts`
2. Add a new `server.tool(...)` call following existing patterns
3. Test: `SERP_API_KEY=... OPENROUTER_API_KEY=... pnpm dev:mcp`

## CI/CD Pipeline

CI runs automatically on every PR:
- **Lint** — ESLint checks
- **Type Check** — TypeScript strict mode across all packages
- **Build** — Frontend, API, and MCP compile successfully
- **Test** — Vitest test suite passes

On merge to `main`:
- **Vercel** auto-deploys frontend + API
- **Supabase migrations** run via GitHub Actions (if migration files changed)
- **Supabase Edge Functions** deploy via GitHub Actions (if function files changed)
- **npm publish** triggers for browse-ai MCP package (if `apps/mcp/` changed and version bumped)

## Publishing the MCP Package (Maintainers Only)

The `browse-ai` npm package lives in `apps/mcp/`. Publishing is automated via CI when the version in `apps/mcp/package.json` is bumped and changes merge to `main`.

To publish manually:

```bash
cd apps/mcp
npm version patch   # or minor/major
npm publish --access public
```

### When to Bump Versions
- **patch** (0.0.x): Bug fixes, typos, minor improvements
- **minor** (0.x.0): New MCP tools, new features, non-breaking changes
- **major** (x.0.0): Breaking changes to tool names, required env vars, or API

## Required Secrets (Maintainers Only)

| Secret | Purpose |
|--------|---------|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth for migrations/functions |
| `SUPABASE_PROJECT_REF` | Supabase project identifier |
| `NPM_TOKEN` | npm publish auth for browse-ai package |

Contributors don't need these — CI handles everything on merge.

## Reporting Issues

Use GitHub issue templates:
- **Bug Report** — steps to reproduce, expected vs actual behavior
- **Feature Request** — problem description, proposed solution
