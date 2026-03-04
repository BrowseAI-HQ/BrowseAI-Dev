# Contributing to Browse AI

Thanks for your interest in contributing! Browse AI is a deep research engine for AI agents.

## Quick Setup

```bash
git clone https://github.com/EiffelHack/ai-agent-browser.git
cd ai-agent-browser
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
ai-agent-browser/
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
  scripts/                # Build & deploy scripts
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

## Contribution Rules

### Branch Policy
- **`main` is protected** — no direct pushes
- All changes must go through a **Pull Request**
- PRs require at least **1 maintainer approval** before merge
- CI checks must pass before merge

### Pull Request Process
1. **Fork** the repo and create a branch from `main`
2. Use branch naming: `feat/...`, `fix/...`, `docs/...`, `refactor/...`
3. **One feature per PR** — keep changes focused
4. Run checks before submitting:
   ```bash
   pnpm lint
   pnpm test
   pnpm build:all
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

## Publishing the MCP Package (Maintainers Only)

The `browse-ai` npm package lives in `apps/mcp/`. To publish a new version:

```bash
cd apps/mcp

# Bump version (pick one)
npm version patch   # 0.1.1 → 0.1.2 (bug fixes)
npm version minor   # 0.1.2 → 0.2.0 (new features)
npm version major   # 0.2.0 → 1.0.0 (breaking changes)

# Publish
npm publish --access public --otp=YOUR_2FA_CODE
```

### When to Bump Versions
- **patch** (0.0.x): Bug fixes, typos, minor improvements
- **minor** (0.x.0): New MCP tools, new features, non-breaking changes
- **major** (x.0.0): Breaking changes to tool names, required env vars, or API

## Reporting Issues

Use GitHub issue templates:
- **Bug Report** — steps to reproduce, expected vs actual behavior
- **Feature Request** — problem description, proposed solution
