# browse-ai

Reliable research infrastructure for AI agents.

MCP server with real-time web search, evidence extraction, and structured citations. Turn any AI assistant into a research engine.

## What it does

Instead of letting your AI hallucinate, `browse-ai` gives it real-time access to the web with **structured, cited answers**:

```
Your question → Web search → Fetch pages → Extract claims → Build evidence graph → Cited answer
```

Every answer includes:
- **Claims** with source URLs
- **Confidence score** (0-1)
- **Source quotes** from actual web pages
- **Execution trace** with timing

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
        "OPENROUTER_API_KEY": "your-openrouter-key"
      }
    }
  }
}
```

### Cursor / Windsurf

Add to your MCP settings:

```json
{
  "browse-ai": {
    "command": "npx",
    "args": ["-y", "browse-ai"],
    "env": {
      "SERP_API_KEY": "tvly-your-key",
      "OPENROUTER_API_KEY": "your-openrouter-key"
    }
  }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `browse_search` | Search the web via Tavily |
| `browse_open` | Fetch and parse a page into clean text |
| `browse_extract` | Extract structured knowledge from a page |
| `browse_answer` | Full pipeline: search + extract + cite |
| `browse_compare` | Compare raw LLM vs evidence-backed answer |

## Example

Ask Claude: *"Use browse_answer to explain what causes aurora borealis"*

Response:
```json
{
  "answer": "Aurora borealis occurs when charged particles from the Sun...",
  "claims": [
    {
      "claim": "Aurora borealis is caused by solar wind particles...",
      "sources": ["https://en.wikipedia.org/wiki/Aurora"]
    }
  ],
  "sources": [
    {
      "url": "https://en.wikipedia.org/wiki/Aurora",
      "title": "Aurora - Wikipedia",
      "domain": "en.wikipedia.org",
      "quote": "An aurora is a natural light display..."
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
| Confidence | Unknown | 0-1 score |
| Freshness | Training data | Real-time web |
| Claims | Mixed in text | Structured + linked |

## Tech Stack

- **Search**: Tavily API
- **Parsing**: @mozilla/readability + linkedom
- **AI**: OpenRouter (100+ models)
- **Protocol**: Model Context Protocol (MCP)

## License

MIT
