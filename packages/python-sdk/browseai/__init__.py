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
    NLIScore,
    PageResult,
    PremiumQuota,
    ReasoningStep,
    RecallResult,
    SearchProviderConfig,
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

__version__ = "0.1.7"
