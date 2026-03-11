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
    Contradiction,
    KnowledgeEntry,
    PageResult,
    RecallResult,
    SearchResult,
    Session,
    SessionAskResult,
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
    "Contradiction",
    "TraceStep",
    "SearchResult",
    "PageResult",
    "CompareResult",
    "Session",
    "KnowledgeEntry",
    "SessionAskResult",
    "RecallResult",
]

__version__ = "0.1.3"
