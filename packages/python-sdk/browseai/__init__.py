"""BrowseAI Dev — Reliable research infrastructure for AI agents."""

from .client import AsyncBrowseAI, BrowseAI
from .exceptions import (
    AuthenticationError,
    BrowseAIError,
    InsufficientCreditsError,
    RateLimitError,
    ServerError,
    ValidationError,
)
from .models import (
    BrowseClaim,
    BrowseResult,
    BrowseSource,
    CompareResult,
    PageResult,
    SearchResult,
    TraceStep,
)

__all__ = [
    "BrowseAI",
    "AsyncBrowseAI",
    "BrowseAIError",
    "AuthenticationError",
    "RateLimitError",
    "InsufficientCreditsError",
    "ValidationError",
    "ServerError",
    "BrowseResult",
    "BrowseSource",
    "BrowseClaim",
    "TraceStep",
    "SearchResult",
    "PageResult",
    "CompareResult",
]

__version__ = "0.1.0"
