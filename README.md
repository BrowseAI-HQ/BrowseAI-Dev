# BrowseAI Dev

**Reliable research infrastructure for AI agents** — open-source research engine with real-time web search, evidence extraction, and structured citations.

Turn any AI agent into a research engine. Every claim is backed by a URL. Every answer has a confidence score. Drop it into LangChain, CrewAI, or any agent pipeline.

```
Agent → BrowseAI → Internet → Verified answers + sources
```

## How It Works

```
search → fetch pages → extract claims → build evidence graph → cited answer
```

Every answer goes through a 5-step verification pipeline. No hallucination. Every claim is backed by a real source.

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
        "OPENROUTER_API_KEY": "your-llm-key"
      }
    }
  }
}
```

### Self-Host

```sh
pnpm install
cp .env.example .env
# Fill in: SERP_API_KEY, OPENROUTER_API_KEY
pnpm dev
```

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
| `POST /browse/answer` | Full pipeline: search + extract + cite |
| `POST /browse/compare` | Compare raw LLM vs evidence-backed answer |
| `GET /browse/share/:id` | Get a shared result |
| `GET /browse/stats` | Total queries answered |
| `GET /browse/sources/top` | Top cited source domains |
| `GET /browse/analytics/summary` | Usage analytics (authenticated) |

## MCP Tools

| Tool | Description |
|------|-------------|
| `browse_search` | Search the web for information on any topic |
| `browse_open` | Fetch and parse a web page into clean text |
| `browse_extract` | Extract structured claims from a page |
| `browse_answer` | Full pipeline: search + extract + cite |
| `browse_compare` | Compare raw LLM vs evidence-backed answer |

## Python SDK

| Method | Description |
|--------|-------------|
| `client.search(query)` | Search the web |
| `client.open(url)` | Fetch and parse a page |
| `client.extract(url, query=)` | Extract claims from a page |
| `client.ask(query)` | Full pipeline with citations |
| `client.compare(query)` | Raw LLM vs evidence-backed |

Async support: `AsyncBrowseAI` with the same API.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SERP_API_KEY` | Yes | Web search API key (Tavily) |
| `OPENROUTER_API_KEY` | Yes | LLM API key (OpenRouter) |
| `REDIS_URL` | No | Redis URL (falls back to in-memory cache) |
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key |
| `PORT` | No | API server port (default: 3001) |

## Examples

See the [examples/](examples/) directory for ready-to-run agent recipes:

| Example | Description |
|---------|-------------|
| [research-agent.py](examples/research-agent.py) | Simple research agent with citations |
| [code-research-agent.py](examples/code-research-agent.py) | Research libraries/docs before writing code |
| [hallucination-detector.py](examples/hallucination-detector.py) | Compare raw LLM vs evidence-backed answers |
| [langchain-agent.py](examples/langchain-agent.py) | BrowseAI as a LangChain tool |
| [crewai-research-team.py](examples/crewai-research-team.py) | Multi-agent research team with CrewAI |

## Community

- [Discord](https://discord.gg/b5SPaGk2) — questions, feedback, showcase
- [GitHub Issues](https://github.com/EiffelHack/BrowserAI-Dev/issues) — bugs, feature requests

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and PR process.

## Tech Stack

- **API**: Node.js, TypeScript, Fastify, Zod
- **Search**: Tavily API
- **Parsing**: @mozilla/readability + linkedom
- **AI**: Gemini 2.5 Flash via OpenRouter
- **Caching**: Redis (optional) / in-memory with intelligent TTL
- **Frontend**: React, Tailwind CSS, shadcn/ui
- **MCP**: @modelcontextprotocol/sdk
- **Python SDK**: httpx, Pydantic
- **Database**: Supabase (PostgreSQL)
