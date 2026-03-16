# browseai → browseaidev

**This package has been renamed to [`browseaidev`](https://pypi.org/project/browseaidev/).** All future development happens under `browseaidev`.

Installing `browseai` will automatically install `browseaidev` and re-export everything. Both old and new imports work.

## What is BrowseAI Dev?

BrowseAI Dev is open-source research infrastructure for AI agents. It provides real-time web search with evidence-backed citations, confidence scores, and contradiction detection. Available as an MCP server, REST API, and Python SDK.

- **MCP Server**: `npx browseai-dev`
- **Python SDK**: `pip install browseaidev` (or `pip install browseai`)
- **REST API**: `https://browseai.dev/api/browse/*`

## Migration

```bash
# Old (still works)
pip install browseai

# New (recommended)
pip install browseaidev
```

```python
# Old imports (still work via this shim)
from browseai import BrowseAI, AsyncBrowseAI

# New imports (recommended)
from browseaidev import BrowseAIDev, AsyncBrowseAIDev
```

## Links

- Website: https://browseai.dev
- GitHub: https://github.com/BrowseAI-HQ/BrowseAI-Dev
- PyPI (new): https://pypi.org/project/browseaidev/
- npm: https://www.npmjs.com/package/browseai-dev
- Discord: https://discord.gg/ubAuT4YQsT
