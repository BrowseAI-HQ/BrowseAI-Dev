# browseai → browseaidev

**This package has been renamed to [`browseaidev`](https://pypi.org/project/browseaidev/).**

Installing `browseai` will automatically install `browseaidev` and re-export everything.

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

All future development happens in the [`browseaidev`](https://github.com/BrowseAI-HQ/BrowseAI-Dev) package.
