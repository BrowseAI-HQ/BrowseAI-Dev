"""Exception classes for BrowseAI SDK."""


class BrowseAIError(Exception):
    """Base exception for BrowseAI SDK."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class AuthenticationError(BrowseAIError):
    """Raised on 401 responses."""


class RateLimitError(BrowseAIError):
    """Raised on 429 responses."""


class InsufficientCreditsError(BrowseAIError):
    """Raised on 402 responses."""


class ValidationError(BrowseAIError):
    """Raised on 400 responses."""


class ServerError(BrowseAIError):
    """Raised on 5xx responses."""
