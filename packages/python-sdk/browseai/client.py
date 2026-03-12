"""BrowseAI Python client — sync and async."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

from .exceptions import (
    AuthenticationError,
    BrowseAIError,
    InsufficientCreditsError,
    RateLimitError,
    ServerError,
    ValidationError,
)
from .models import (
    BrowseResult,
    CompareResult,
    KnowledgeEntry,
    PageResult,
    RecallResult,
    SearchResult,
    Session,
    SessionAskResult,
)

DEFAULT_BASE_URL = "https://browseai.dev/api"
DEFAULT_TIMEOUT = 60.0


def _build_headers(
    api_key: str | None,
    tavily_key: str | None,
    openrouter_key: str | None,
) -> dict[str, str]:
    headers: dict[str, str] = {}
    if api_key:
        headers["X-API-Key"] = api_key
    if tavily_key:
        headers["X-Tavily-Key"] = tavily_key
    if openrouter_key:
        headers["X-OpenRouter-Key"] = openrouter_key
    return headers


def _handle_error(response: httpx.Response) -> None:
    if response.is_success:
        return

    try:
        body = response.json()
        message = body.get("error", response.text)
    except Exception:
        message = response.text

    status = response.status_code
    if status == 401:
        raise AuthenticationError(message, status)
    if status == 402:
        raise InsufficientCreditsError(message, status)
    if status == 429:
        raise RateLimitError(message, status)
    if status == 400:
        raise ValidationError(message, status)
    if status >= 500:
        raise ServerError(message, status)
    raise BrowseAIError(message, status)


class BrowseAI:
    """Synchronous BrowseAI client.

    Usage::

        from browseai import BrowseAI

        client = BrowseAI(api_key="bai_xxx")
        result = client.ask("What is quantum computing?")
        print(result.answer)
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        tavily_key: str | None = None,
        openrouter_key: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        if not api_key and not (tavily_key and openrouter_key):
            raise ValueError("Provide api_key or both tavily_key and openrouter_key")

        self._headers = _build_headers(api_key, tavily_key, openrouter_key)
        self._client = httpx.Client(
            base_url=base_url,
            headers=self._headers,
            timeout=timeout,
        )

    @classmethod
    def from_config(cls, config_path: str | None = None, **kwargs: Any) -> "BrowseAI":
        """Create a client from ~/.browseai.json (written by ``browseai setup``)."""
        path = config_path or os.path.expanduser("~/.browseai.json")
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"No config found at {path}. Run 'browseai setup' first."
            )
        with open(path) as f:
            config = json.load(f)
        return cls(
            api_key=config.get("api_key"),
            tavily_key=config.get("tavily_key"),
            openrouter_key=config.get("openrouter_key"),
            **kwargs,
        )

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        response = self._client.post(path, json=body)
        _handle_error(response)
        data = response.json()
        if not data.get("success"):
            raise BrowseAIError(data.get("error", "Unknown error"))
        return data["result"]

    def _get(self, path: str) -> dict[str, Any]:
        response = self._client.get(path)
        _handle_error(response)
        data = response.json()
        if not data.get("success"):
            raise BrowseAIError(data.get("error", "Unknown error"))
        return data["result"]

    def search(self, query: str, *, limit: int = 5) -> list[SearchResult]:
        """Search the web. Returns ranked results with URLs, titles, and snippets."""
        data = self._post("/browse/search", {"query": query, "limit": limit})
        return [SearchResult(**r) for r in data["results"]]

    def open(self, url: str) -> PageResult:
        """Fetch and parse a web page into clean text."""
        data = self._post("/browse/open", {"url": url})
        return PageResult(**data)

    def extract(self, url: str, *, query: str | None = None) -> BrowseResult:
        """Extract structured knowledge from a single web page."""
        body: dict[str, Any] = {"url": url}
        if query:
            body["query"] = query
        data = self._post("/browse/extract", body)
        return BrowseResult(**data)

    def ask(self, query: str, *, depth: str = "fast") -> BrowseResult:
        """Full research pipeline: search, fetch, extract, and answer with citations.

        Args:
            query: The research question.
            depth: 'fast' (default) or 'thorough'. Thorough mode auto-retries
                   with a rephrased query when confidence is below 60%.
        """
        data = self._post("/browse/answer", {"query": query, "depth": depth})
        return BrowseResult(**data)

    def compare(self, query: str) -> CompareResult:
        """Compare raw LLM answer vs evidence-backed answer."""
        data = self._post("/browse/compare", {"query": query})
        return CompareResult(**data)

    def get_shared(self, share_id: str) -> dict[str, Any]:
        """Retrieve a shared result by ID."""
        return self._get(f"/browse/share/{share_id}")

    def stats(self) -> dict[str, Any]:
        """Get total query count."""
        return self._get("/browse/stats")

    # ── Research Memory ──

    def session(self, name: str) -> "SessionClient":
        """Create or resume a research session.

        Usage::

            session = client.session("my-project")
            r1 = session.ask("What is WASM?")
            r2 = session.ask("WASM vs JS?")  # recalls prior WASM knowledge
            knowledge = session.recall("WASM")
        """
        data = self._post("/session", {"name": name})
        sess = Session(**data)
        return SessionClient(self, sess)

    def get_session(self, session_id: str) -> "SessionClient":
        """Resume an existing session by ID."""
        data = self._get(f"/session/{session_id}")
        sess = Session(**data)
        return SessionClient(self, sess)

    def list_sessions(self) -> list[Session]:
        """List all sessions for the authenticated user."""
        data = self._get("/sessions")
        return [Session(**s) for s in data]

    def fork_session(self, share_id: str) -> "SessionClient":
        """Fork a shared session to continue building on someone else's research."""
        data = self._post(f"/session/share/{share_id}/fork", {})
        sess = Session(**data["session"])
        return SessionClient(self, sess)

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class SessionClient:
    """Stateful research session. Created via ``client.session("name")``."""

    def __init__(self, client: BrowseAI, session: Session):
        self._client = client
        self.session = session

    @property
    def id(self) -> str:
        return self.session.id

    @property
    def name(self) -> str:
        return self.session.name

    def ask(self, query: str, *, depth: str = "fast") -> SessionAskResult:
        """Research with session context — recalls prior knowledge, stores new claims."""
        data = self._client._post(f"/session/{self.id}/ask", {"query": query, "depth": depth})
        return SessionAskResult(**data)

    def recall(self, query: str, *, limit: int = 10) -> RecallResult:
        """Query session knowledge without new web search."""
        data = self._client._post(f"/session/{self.id}/recall", {"query": query, "limit": limit})
        return RecallResult(**data)

    def knowledge(self, *, limit: int = 50) -> list[KnowledgeEntry]:
        """Export all knowledge entries from this session."""
        data = self._client._get(f"/session/{self.id}/knowledge")
        return [KnowledgeEntry(**e) for e in data.get("entries", [])]

    def share(self) -> dict:
        """Share this session publicly. Returns shareId and URL."""
        data = self._client._post(f"/session/{self.id}/share", {})
        share_id = data.get("shareId", "")
        return {
            "share_id": share_id,
            "url": f"https://browseai.dev/session/share/{share_id}",
        }

    def delete(self) -> None:
        """Delete this session and all its knowledge."""
        self._client._client.delete(f"/session/{self.id}")


class AsyncBrowseAI:
    """Async BrowseAI client.

    Usage::

        import asyncio
        from browseai import AsyncBrowseAI

        async def main():
            async with AsyncBrowseAI(api_key="bai_xxx") as client:
                result = await client.ask("What is quantum computing?")
                print(result.answer)

        asyncio.run(main())
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        tavily_key: str | None = None,
        openrouter_key: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        if not api_key and not (tavily_key and openrouter_key):
            raise ValueError("Provide api_key or both tavily_key and openrouter_key")

        self._headers = _build_headers(api_key, tavily_key, openrouter_key)
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers=self._headers,
            timeout=timeout,
        )

    @classmethod
    def from_config(cls, config_path: str | None = None, **kwargs: Any) -> "AsyncBrowseAI":
        """Create an async client from ~/.browseai.json (written by ``browseai setup``)."""
        path = config_path or os.path.expanduser("~/.browseai.json")
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"No config found at {path}. Run 'browseai setup' first."
            )
        with open(path) as f:
            config = json.load(f)
        return cls(
            api_key=config.get("api_key"),
            tavily_key=config.get("tavily_key"),
            openrouter_key=config.get("openrouter_key"),
            **kwargs,
        )

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        response = await self._client.post(path, json=body)
        _handle_error(response)
        data = response.json()
        if not data.get("success"):
            raise BrowseAIError(data.get("error", "Unknown error"))
        return data["result"]

    async def _get(self, path: str) -> dict[str, Any]:
        response = await self._client.get(path)
        _handle_error(response)
        data = response.json()
        if not data.get("success"):
            raise BrowseAIError(data.get("error", "Unknown error"))
        return data["result"]

    async def search(self, query: str, *, limit: int = 5) -> list[SearchResult]:
        data = await self._post("/browse/search", {"query": query, "limit": limit})
        return [SearchResult(**r) for r in data["results"]]

    async def open(self, url: str) -> PageResult:
        data = await self._post("/browse/open", {"url": url})
        return PageResult(**data)

    async def extract(self, url: str, *, query: str | None = None) -> BrowseResult:
        body: dict[str, Any] = {"url": url}
        if query:
            body["query"] = query
        data = await self._post("/browse/extract", body)
        return BrowseResult(**data)

    async def ask(self, query: str, *, depth: str = "fast") -> BrowseResult:
        """Full research pipeline with optional thorough mode.

        Args:
            query: The research question.
            depth: 'fast' (default) or 'thorough'.
        """
        data = await self._post("/browse/answer", {"query": query, "depth": depth})
        return BrowseResult(**data)

    async def compare(self, query: str) -> CompareResult:
        data = await self._post("/browse/compare", {"query": query})
        return CompareResult(**data)

    async def get_shared(self, share_id: str) -> dict[str, Any]:
        return await self._get(f"/browse/share/{share_id}")

    async def stats(self) -> dict[str, Any]:
        return await self._get("/browse/stats")

    # ── Research Memory ──

    async def session(self, name: str) -> "AsyncSessionClient":
        """Create or resume a research session."""
        data = await self._post("/session", {"name": name})
        sess = Session(**data)
        return AsyncSessionClient(self, sess)

    async def get_session(self, session_id: str) -> "AsyncSessionClient":
        """Resume an existing session by ID."""
        data = await self._get(f"/session/{session_id}")
        sess = Session(**data)
        return AsyncSessionClient(self, sess)

    async def list_sessions(self) -> list[Session]:
        """List all sessions for the authenticated user."""
        data = await self._get("/sessions")
        return [Session(**s) for s in data]

    async def fork_session(self, share_id: str) -> "AsyncSessionClient":
        """Fork a shared session to continue building on someone else's research."""
        data = await self._post(f"/session/share/{share_id}/fork", {})
        sess = Session(**data["session"])
        return AsyncSessionClient(self, sess)

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()


class AsyncSessionClient:
    """Async stateful research session."""

    def __init__(self, client: AsyncBrowseAI, session: Session):
        self._client = client
        self.session = session

    @property
    def id(self) -> str:
        return self.session.id

    @property
    def name(self) -> str:
        return self.session.name

    async def ask(self, query: str, *, depth: str = "fast") -> SessionAskResult:
        """Research with session context."""
        data = await self._client._post(f"/session/{self.id}/ask", {"query": query, "depth": depth})
        return SessionAskResult(**data)

    async def recall(self, query: str, *, limit: int = 10) -> RecallResult:
        """Query session knowledge without new web search."""
        data = await self._client._post(f"/session/{self.id}/recall", {"query": query, "limit": limit})
        return RecallResult(**data)

    async def knowledge(self, *, limit: int = 50) -> list[KnowledgeEntry]:
        """Export all knowledge entries from this session."""
        data = await self._client._get(f"/session/{self.id}/knowledge")
        return [KnowledgeEntry(**e) for e in data.get("entries", [])]

    async def share(self) -> dict:
        """Share this session publicly. Returns shareId and URL."""
        data = await self._client._post(f"/session/{self.id}/share", {})
        share_id = data.get("shareId", "")
        return {
            "share_id": share_id,
            "url": f"https://browseai.dev/session/share/{share_id}",
        }

    async def delete(self) -> None:
        """Delete this session and all its knowledge."""
        await self._client._client.delete(f"/session/{self.id}")
