# browse-ai → browseai-dev

**This package has been renamed to [`browseai-dev`](https://www.npmjs.com/package/browseai-dev).** All future development happens under `browseai-dev`.

Installing `browse-ai` will automatically install `browseai-dev` and proxy all commands. Both old and new commands work.

## What is BrowseAI Dev?

BrowseAI Dev is open-source research infrastructure for AI agents. It provides an MCP server with real-time web search, evidence-backed citations, confidence scores, and contradiction detection. Works with Claude, Cursor, Windsurf, and any MCP-compatible client.

- **MCP Server**: `npx browseai-dev` (or `npx browse-ai`)
- **Python SDK**: `pip install browseaidev`
- **REST API**: `https://browseai.dev/api/browse/*`

## Migration

```bash
# Old (still works)
npx browse-ai

# New (recommended)
npx browseai-dev
```

## MCP Configuration

```json
{
  "mcpServers": {
    "browseai-dev": {
      "command": "npx",
      "args": ["-y", "browseai-dev"]
    }
  }
}
```

## Links

- Website: https://browseai.dev
- GitHub: https://github.com/BrowseAI-HQ/BrowseAI-Dev
- npm (new): https://www.npmjs.com/package/browseai-dev
- PyPI: https://pypi.org/project/browseaidev/
- Discord: https://discord.gg/ubAuT4YQsT
