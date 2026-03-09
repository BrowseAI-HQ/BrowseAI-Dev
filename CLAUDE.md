# CLAUDE.md — BrowseAI Dev

## What this project is

BrowseAI Dev is open-source research infrastructure for AI agents. It gives agents real-time web search with evidence-backed citations and confidence scores. Available as MCP server, REST API, and Python SDK.

**Tagline:** Reliable Research Infrastructure for AI Agents

## Monorepo structure

```
apps/api/          — Fastify REST API (search, answer, extract, compare)
apps/mcp/          — MCP server (npm: browse-ai, v0.1.5)
packages/shared/   — Shared types, schemas, constants
packages/python-sdk/ — Python SDK (PyPI: browseai, v0.1.0)
src/               — Vite + React frontend (landing, developers, playground pages)
```

## Key commands

```bash
pnpm dev              # Run frontend + API concurrently
pnpm dev:api          # API only (port 3001)
pnpm dev:web          # Frontend only (Vite)
pnpm build            # Full build (Vercel)
pnpm test             # Run tests (vitest)
npx pnpm --filter api build   # Build API only (tsc)
npx pnpm --filter browse-ai build  # Build MCP only
```

## Architecture decisions

- **LLM:** Google Gemini 2.5 Flash via OpenRouter (`packages/shared/src/constants.ts`)
- **Search:** Tavily API for web search
- **Confidence scores:** Evidence-based algorithm in `apps/api/src/lib/gemini.ts` — NOT LLM self-assessed. Computed from source count, domain diversity, claim grounding, and citation depth.
- **Caching:** In-memory CacheService with smart TTL (time-sensitive queries get shorter TTL)
- **Demo rate limit:** 5/hour per IP for unauthenticated users. BYOK headers (`X-Tavily-Key`, `X-OpenRouter-Key`) bypass it.
- **API keys:** Users can bring their own keys via headers, or use a BrowseAI API key (`bai_xxx` prefix), or fall back to server-side keys with demo limits.

## Environment variables

```
SERP_API_KEY          — Tavily API key (for search)
OPENROUTER_API_KEY    — OpenRouter key (for LLM)
SUPABASE_URL          — Supabase project URL
SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
API_KEY_ENCRYPTION_KEY — AES-256-GCM key for encrypting stored API keys
```

## Deployment

- **Frontend + API:** Vercel (auto-deploys from main)
- **MCP (npm):** Auto-publishes via `.github/workflows/publish-npm.yml` on push to main
- **Python SDK (PyPI):** Auto-publishes via `.github/workflows/publish-pypi.yml` on push to main
- **Branch protection:** main is protected. All changes go through PRs from `shreyas` branch.
- **Version bumps:** Bump version in feature branch before merging — CI skips publish if version unchanged.

## Coding conventions

- TypeScript strict mode for API and shared packages
- React with Tailwind CSS + shadcn/ui components
- Framer Motion for animations on landing/dev pages
- Keep API responses as `{ success: boolean, result?: T, error?: string }`
- All browse endpoints follow the pattern: parse → getRequestEnv → checkDemoLimit → execute → return

## Important files

- `apps/api/src/routes/browse.ts` — All API endpoints (search, answer, extract, compare, share)
- `apps/api/src/lib/gemini.ts` — LLM extraction + confidence algorithm
- `apps/api/src/services/compare.ts` — Raw LLM vs evidence-backed comparison
- `packages/shared/src/types.ts` — BrowseResult, BrowseClaim, BrowseSource types
- `src/pages/Index.tsx` — Landing page
- `src/pages/Developers.tsx` — Developer page
- `src/pages/Playground.tsx` — Interactive playground

## Links

- **Site:** https://browseai.dev
- **GitHub:** https://github.com/BrowseAI-HQ/BrowserAI-Dev
- **Discord:** https://discord.gg/ubAuT4YQsT
- **npm:** https://www.npmjs.com/package/browse-ai
- **PyPI:** https://pypi.org/project/browseai/
- **License:** MIT
