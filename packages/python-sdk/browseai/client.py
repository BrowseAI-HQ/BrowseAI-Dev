"""BrowseAI Python client — sync and async."""

from __future__ import annotations

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
    PageResult,
    SearchResult,
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
        return [SearchResult(**r) for r in data]

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

    def ask(self, query: str) -> BrowseResult:
        """Full research pipeline: search, fetch, extract, and answer with citations."""
        data = self._post("/browse/answer", {"query": query})
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

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


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
        return [SearchResult(**r) for r in data]

    async def open(self, url: str) -> PageResult:
        data = await self._post("/browse/open", {"url": url})
        return PageResult(**data)

    async def extract(self, url: str, *, query: str | None = None) -> BrowseResult:
        body: dict[str, Any] = {"url": url}
        if query:
            body["query"] = query
        data = await self._post("/browse/extract", body)
        return BrowseResult(**data)

    async def ask(self, query: str) -> BrowseResult:
        data = await self._post("/browse/answer", {"query": query})
        return BrowseResult(**data)

    async def compare(self, query: str) -> CompareResult:
        data = await self._post("/browse/compare", {"query": query})
        return CompareResult(**data)

    async def get_shared(self, share_id: str) -> dict[str, Any]:
        return await self._get(f"/browse/share/{share_id}")

    async def stats(self) -> dict[str, Any]:
        return await self._get("/browse/stats")

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()
