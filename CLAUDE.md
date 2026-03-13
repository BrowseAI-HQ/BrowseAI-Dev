# CLAUDE.md — BrowseAI Dev

## What this project is

BrowseAI Dev is open-source research infrastructure for AI agents. It gives agents real-time web search with evidence-backed citations and confidence scores. Available as MCP server, REST API, and Python SDK.

**Tagline:** Reliable Research Infrastructure for AI Agents

## Monorepo structure

```
apps/api/          — Fastify REST API (search, answer, extract, compare)
apps/mcp/          — MCP server (npm: browse-ai)
packages/shared/   — Shared types, schemas, constants
packages/python-sdk/ — Python SDK (PyPI: browseai)
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
- **Verification pipeline:** BM25 sentence matching → cross-source consensus → contradiction detection (`apps/api/src/lib/verify.ts`)
- **Confidence scores:** 7-factor evidence-based algorithm in `apps/api/src/lib/gemini.ts` — NOT LLM self-assessed. Factors: source count, domain diversity, claim grounding, citation depth, verification rate, domain authority, consensus score. Contradiction penalty applied.
- **Domain authority:** 10,000+ domains in Supabase (260 curated + Majestic Million), 5-tier scoring with Bayesian dynamic blending from real query verification data. Cold-start safe via prior weight smoothing.
- **Thorough mode:** `depth: "thorough"` auto-retries with rephrased query when first-pass confidence < 60%. Available across API, MCP, and Python SDK.
- **Caching:** Upstash Redis (via Vercel KV) with smart TTL (time-sensitive queries get shorter TTL). Falls back to in-memory if KV env vars not set. Cache key includes depth param.
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
- `apps/api/src/lib/gemini.ts` — LLM extraction + confidence algorithm + query rephrasing
- `apps/api/src/lib/verify.ts` — Full verification engine (BM25, consensus, contradictions, domain authority)
- `apps/api/src/services/answer.ts` — Answer pipeline with thorough mode retry logic
- `apps/api/src/services/compare.ts` — Raw LLM vs evidence-backed comparison
- `apps/api/src/services/store.ts` — Supabase result storage + domain stats aggregation
- `apps/api/src/routes/admin.ts` — Admin endpoints (metrics, recalculate-authority)
- `packages/shared/src/types.ts` — BrowseResult, BrowseClaim, BrowseSource, Contradiction types
- `packages/shared/src/schemas.ts` — Zod schemas for all request types
- `apps/mcp/src/index.ts` — MCP server tool definitions
- `packages/python-sdk/browseai/client.py` — Python SDK (sync + async clients)
- `src/pages/Index.tsx` — Landing page
- `src/pages/Developers.tsx` — Developer page (roadmap, code examples)
- `src/pages/Playground.tsx` — Interactive playground

## Ship checklist — run this after every feature

Every time a new feature is implemented, go through this checklist before considering it done. This ensures all surfaces stay in sync.

### 1. Code (always)
- [ ] Types updated in `packages/shared/src/types.ts`
- [ ] Schemas updated in `packages/shared/src/schemas.ts`
- [ ] Build all packages: `npx pnpm --filter shared build && npx pnpm --filter api build && npx pnpm --filter browse-ai build`
- [ ] Run tests: `npx pnpm test`
- [ ] Full build passes: `npx pnpm build`

### 2. API surfaces (if feature adds/changes parameters or behavior)
- [ ] REST API route updated in `apps/api/src/routes/browse.ts`
- [ ] MCP tool schema updated in `apps/mcp/src/index.ts` (params, description)
- [ ] Python SDK methods updated in `packages/python-sdk/browseai/client.py` (both sync + async)
- [ ] Python SDK models updated in `packages/python-sdk/browseai/models.py` (if new response fields)

### 3. Documentation (if feature is user-facing)
- [ ] `README.md` — Update feature list, verification pipeline description, API examples
- [ ] `src/pages/Index.tsx` — Landing page pipeline steps, "Why BrowseAI" section, example JSON output
- [ ] `src/pages/Developers.tsx` — Roadmap items (mark Done/update descriptions), code examples
- [ ] `apps/mcp/README.md` — MCP tool docs if tool params changed
- [ ] `packages/python-sdk/README.md` — Python SDK usage examples if method signatures changed

### 4. Versioning (if publishing)
- [ ] Bump version in `apps/mcp/package.json` AND `apps/mcp/src/index.ts` (`VERSION` constant) — must match
- [ ] Bump version in `packages/python-sdk/pyproject.toml` AND `packages/python-sdk/browseai/__init__.py` (`__version__`) — must match
- [ ] CI auto-publishes on merge to main but **skips if version unchanged** — always bump before merging
- [ ] Update `CLAUDE.md` architecture section if significant new capability

### 5. Ship
- [ ] Commit with descriptive message
- [ ] Push to `shreyas` branch
- [ ] Create PR to `main`
- [ ] Verify PR build passes before merge

## Links

- **Site:** https://browseai.dev
- **GitHub:** https://github.com/BrowseAI-HQ/BrowseAI-Dev
- **Discord:** https://discord.gg/ubAuT4YQsT
- **npm:** https://www.npmjs.com/package/browse-ai
- **PyPI:** https://pypi.org/project/browseai/
- **License:** MIT
