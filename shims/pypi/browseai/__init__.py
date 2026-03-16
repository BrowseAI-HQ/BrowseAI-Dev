"""
browseai — redirect shim package.

This package now installs and re-exports browseaidev.
All future development happens under the browseaidev package name.

    pip install browseaidev   (recommended)
    pip install browseai      (works, pulls in browseaidev)
"""

import warnings as _warnings

_warnings.warn(
    "The 'browseai' package has been renamed to 'browseaidev'. "
    "Please update your imports: pip install browseaidev",
    DeprecationWarning,
    stacklevel=2,
)

# Re-export everything from browseaidev with old class name aliases
from browseaidev import (
    AsyncBrowseAIDev,
    AuthenticationError,
    BrowseAIDev,
    BrowseAIDevError,
    BrowseClaim,
    BrowseResult,
    BrowseSource,
    CompareResult,
    Contradiction,
    InsufficientCreditsError,
    KnowledgeEntry,
    NLIScore,
    PageResult,
    PremiumQuota,
    RateLimitError,
    ReasoningStep,
    RecallResult,
    SearchProviderConfig,
    SearchResult,
    ServerError,
    Session,
    SessionAskResult,
    TraceStep,
    ValidationError,
)

# Old class name aliases for backwards compatibility
BrowseAI = BrowseAIDev
AsyncBrowseAI = AsyncBrowseAIDev
BrowseAIError = BrowseAIDevError

__all__ = [
    # New names (preferred)
    "BrowseAIDev",
    "AsyncBrowseAIDev",
    "BrowseAIDevError",
    # Old aliases (backwards compat)
    "BrowseAI",
    "AsyncBrowseAI",
    "BrowseAIError",
    # Shared
    "AuthenticationError",
    "RateLimitError",
    "InsufficientCreditsError",
    "ValidationError",
    "ServerError",
    "BrowseResult",
    "BrowseSource",
    "BrowseClaim",
    "Contradiction",
    "ReasoningStep",
    "TraceStep",
    "SearchResult",
    "PageResult",
    "CompareResult",
    "Session",
    "KnowledgeEntry",
    "SessionAskResult",
    "RecallResult",
    "PremiumQuota",
    "SearchProviderConfig",
    "NLIScore",
]

__version__ = "0.2.1"
