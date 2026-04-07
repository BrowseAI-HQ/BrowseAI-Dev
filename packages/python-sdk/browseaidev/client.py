"""BrowseAI Dev Python client — sync and async."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

from .exceptions import (
    AuthenticationError,
    BrowseAIDevError,
    InsufficientCreditsError,
    RateLimitError,
    ServerError,
    ValidationError,
)
from .models import (
    BrowseResult,
    CompareResult,
    ClarityResult,
    KnowledgeEntry,
    PageResult,
    PremiumQuota,
    RecallResult,
    SearchProviderConfig,
    SearchResult,
    Session,
    SessionAskResult,
)

DEFAULT_BASE_URL = "https://browseai.dev/api"
DEFAULT_TIMEOUT = 60.0

DISCLAIMER = (
    "AI-generated research for informational purposes only. "
    "Not financial, medical, legal, or professional advice. "
    "Confidence scores are algorithmic estimates, not guarantees of accuracy. "
    "Verify critical information from authoritative primary sources before acting. "
    "See https://browseai.dev/terms"
)


def _build_headers(api_key: str) -> dict[str, str]:
    return {"X-API-Key": api_key}


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
    raise BrowseAIDevError(message, status)


class BrowseAIDev:
    """Synchronous BrowseAI Dev client.

    Usage::

        from browseaidev import BrowseAIDev

        client = BrowseAIDev(api_key="bai_xxx")
        result = client.ask("What is quantum computing?")
        print(result.answer)
    """

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        if not api_key:
            raise ValueError(
                "api_key is required. Sign in and get your free API key at https://browseai.dev"
            )
        if not api_key.startswith("bai_"):
            raise ValueError(
                "Invalid API key format — must start with 'bai_'. "
                "Sign in and get your free API key at https://browseai.dev"
            )

        self._headers = _build_headers(api_key)
        self._last_quota: PremiumQuota | None = None
        self._client = httpx.Client(
            base_url=base_url,
            headers=self._headers,
            timeout=timeout,
        )

    @classmethod
    def from_config(cls, config_path: str | None = None, **kwargs: Any) -> "BrowseAIDev":
        """Create a client from ~/.browseaidev.json (written by ``browseaidev setup``)."""
        path = config_path or os.path.expanduser("~/.browseaidev.json")
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"No config found at {path}. Run 'browseaidev setup' first."
            )
        with open(path) as f:
            config = json.load(f)
        api_key = config.get("api_key")
        if not api_key:
            raise ValueError(
                "No api_key in config. Run 'browseaidev setup' to configure your BAI key."
            )
        return cls(api_key=api_key, **kwargs)

    @property
    def last_quota(self) -> PremiumQuota | None:
        """Premium quota info from the last API call (if available)."""
        return self._last_quota

    @property
    def disclaimer(self) -> str:
        """Legal disclaimer for all AI-generated results."""
        return DISCLAIMER

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        response = self._client.post(path, json=body)
        _handle_error(response)
        data = response.json()
        if not data.get("success"):
            raise BrowseAIDevError(data.get("error", "Unknown error"))
        if "quota" in data:
            self._last_quota = PremiumQuota(**data["quota"])
        return data["result"]

    def _get(self, path: str) -> dict[str, Any]:
        response = self._client.get(path)
        _handle_error(response)
        data = response.json()
        if not data.get("success"):
            raise BrowseAIDevError(data.get("error", "Unknown error"))
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

    def ask(
        self,
        query: str,
        *,
        depth: str = "fast",
        search_provider: SearchProviderConfig | dict | None = None,
    ) -> BrowseResult:
        """Full research pipeline: search, fetch, extract, and answer with citations.

        Args:
            query: The research question.
            depth: 'fast' (default), 'thorough' (auto-retry if confidence < 60%),
                   or 'deep' (multi-step agentic research with gap analysis).
            search_provider: Enterprise search provider config. Use to search
                internal data (Elasticsearch, Confluence, custom endpoint)
                instead of the public web.
        """
        body: dict[str, Any] = {"query": query, "depth": depth}
        if search_provider is not None:
            if isinstance(search_provider, SearchProviderConfig):
                body["searchProvider"] = search_provider.model_dump(by_alias=True, exclude_none=True)
            else:
                body["searchProvider"] = search_provider
        data = self._post("/browse/answer", body)
        return BrowseResult(**data)

    def compare(self, query: str) -> CompareResult:
        """Compare raw LLM answer vs evidence-backed answer."""
        data = self._post("/browse/compare", {"query": query})
        return CompareResult(**data)

    def verify_document(
        self,
        text: str | None = None,
        *,
        url: str | None = None,
        title: str | None = None,
        depth: str = "fast",
        max_claims: int = 20,
    ) -> dict:
        """Fact-check an entire document.

        Extracts every atomic claim from the document and verifies each against
        live web sources via the Evidence Engine pipeline. Returns a per-claim
        verification report with sources, NLI scores, and an overall A-F grade.

        Args:
            text: The document text to verify (50-50000 characters). Provide
                either text OR url.
            url: URL to fetch and verify (alternative to text).
            title: Optional document title for context.
            depth: "fast" for quick triage, "thorough" for high-stakes audits.
            max_claims: Maximum claims to extract and verify (1-50).

        Returns:
            Dict with summary stats and per-claim verification details.
        """
        if not text and not url:
            raise ValueError("Either text or url must be provided")
        body: dict = {"depth": depth, "maxClaims": max_claims}
        if text:
            body["text"] = text
        if url:
            body["url"] = url
        if title:
            body["title"] = title
        return self._post("/browse/verify-document", body)

    def clarity(
        self,
        prompt: str,
        *,
        context: str | None = None,
        intent: str | None = None,
        mode: str | None = None,
        depth: str | None = None,
        verify: bool = False,
    ) -> ClarityResult:
        """Clarity — anti-hallucination answer engine.

        Three modes:
        - mode="prompt": Returns only enhanced system + user prompts (no LLM call,
          no internet). Use when your own LLM (e.g. Claude) should answer using
          the anti-hallucination prompts.
        - mode="answer" (default): Rewrites prompt with anti-hallucination techniques,
          calls LLM with grounding instructions, returns a higher-quality answer
          with extracted claims. Fast, no internet.
        - mode="verified": Does the above, then also runs the full browse pipeline
          (search + extract + verify), fuses the best of both — keeps source-backed
          claims, drops fabricated ones, returns one unified answer.

        Args:
            prompt: The prompt to answer with anti-hallucination techniques.
            context: Optional context documents to ground against.
            intent: Override auto-detected intent (factual_question, document_qa,
                    content_generation, agent_pipeline, code_generation, general).
            mode: 'prompt' (prompts only), 'answer' (LLM answer), or 'verified'
                  (LLM + web fusion). Defaults to 'answer'.
            depth: Research depth for verified mode: 'fast' (default), 'thorough',
                   or 'deep' (agentic multi-step research).
            verify: Deprecated. Use mode='verified' instead.
        """
        body: dict[str, Any] = {"prompt": prompt}
        if context is not None:
            body["context"] = context
        if intent is not None:
            body["intent"] = intent
        if mode is not None:
            body["mode"] = mode
        if depth is not None:
            body["depth"] = depth
        elif verify:
            body["verify"] = True
        data = self._post("/browse/clarity", body)
        return ClarityResult(**data)

    def get_shared(self, share_id: str) -> dict[str, Any]:
        """Retrieve a shared result by ID."""
        return self._get(f"/browse/share/{share_id}")

    def stats(self) -> dict[str, Any]:
        """Get total query count."""
        return self._get("/browse/stats")

    def feedback(self, result_id: str, rating: str, claim_index: int | None = None) -> dict[str, Any]:
        """Submit feedback on a result. Rating: 'good', 'bad', or 'wrong'."""
        body: dict[str, Any] = {"resultId": result_id, "rating": rating}
        if claim_index is not None:
            body["claimIndex"] = claim_index
        return self._post("/browse/feedback", body)

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

    def __init__(self, client: BrowseAIDev, session: Session):
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
        data = self._client._get(f"/session/{self.id}/knowledge?limit={limit}")
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
        response = self._client._client.delete(f"/session/{self.id}")
        _handle_error(response)
        data = response.json()
        if not data.get("success"):
            raise BrowseAIDevError(data.get("error", "Unknown error"))


class AsyncBrowseAIDev:
    """Async BrowseAI Dev client.

    Usage::

        import asyncio
        from browseaidev import AsyncBrowseAIDev

        async def main():
            async with AsyncBrowseAIDev(api_key="bai_xxx") as client:
                result = await client.ask("What is quantum computing?")
                print(result.answer)

        asyncio.run(main())
    """

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        if not api_key:
            raise ValueError(
                "api_key is required. Sign in and get your free API key at https://browseai.dev"
            )
        if not api_key.startswith("bai_"):
            raise ValueError(
                "Invalid API key format — must start with 'bai_'. "
                "Sign in and get your free API key at https://browseai.dev"
            )

        self._headers = _build_headers(api_key)
        self._last_quota: PremiumQuota | None = None
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers=self._headers,
            timeout=timeout,
        )

    @classmethod
    def from_config(cls, config_path: str | None = None, **kwargs: Any) -> "AsyncBrowseAIDev":
        """Create an async client from ~/.browseaidev.json (written by ``browseaidev setup``)."""
        path = config_path or os.path.expanduser("~/.browseaidev.json")
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"No config found at {path}. Run 'browseaidev setup' first."
            )
        with open(path) as f:
            config = json.load(f)
        api_key = config.get("api_key")
        if not api_key:
            raise ValueError(
                "No api_key in config. Run 'browseaidev setup' to configure your BAI key."
            )
        return cls(api_key=api_key, **kwargs)

    @property
    def last_quota(self) -> PremiumQuota | None:
        """Premium quota info from the last API call (if available)."""
        return self._last_quota

    @property
    def disclaimer(self) -> str:
        """Legal disclaimer for all AI-generated results."""
        return DISCLAIMER

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        response = await self._client.post(path, json=body)
        _handle_error(response)
        data = response.json()
        if not data.get("success"):
            raise BrowseAIDevError(data.get("error", "Unknown error"))
        if "quota" in data:
            self._last_quota = PremiumQuota(**data["quota"])
        return data["result"]

    async def _get(self, path: str) -> dict[str, Any]:
        response = await self._client.get(path)
        _handle_error(response)
        data = response.json()
        if not data.get("success"):
            raise BrowseAIDevError(data.get("error", "Unknown error"))
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

    async def ask(
        self,
        query: str,
        *,
        depth: str = "fast",
        search_provider: SearchProviderConfig | dict | None = None,
    ) -> BrowseResult:
        """Full research pipeline with optional deep mode.

        Args:
            query: The research question.
            depth: 'fast' (default), 'thorough', or 'deep' (multi-step agentic).
            search_provider: Enterprise search provider config.
        """
        body: dict[str, Any] = {"query": query, "depth": depth}
        if search_provider is not None:
            if isinstance(search_provider, SearchProviderConfig):
                body["searchProvider"] = search_provider.model_dump(by_alias=True, exclude_none=True)
            else:
                body["searchProvider"] = search_provider
        data = await self._post("/browse/answer", body)
        return BrowseResult(**data)

    async def compare(self, query: str) -> CompareResult:
        data = await self._post("/browse/compare", {"query": query})
        return CompareResult(**data)

    async def verify_document(
        self,
        text: str | None = None,
        *,
        url: str | None = None,
        title: str | None = None,
        depth: str = "fast",
        max_claims: int = 20,
    ) -> dict:
        """Fact-check an entire document. See sync version for details."""
        if not text and not url:
            raise ValueError("Either text or url must be provided")
        body: dict = {"depth": depth, "maxClaims": max_claims}
        if text:
            body["text"] = text
        if url:
            body["url"] = url
        if title:
            body["title"] = title
        return await self._post("/browse/verify-document", body)

    async def clarity(
        self,
        prompt: str,
        *,
        context: str | None = None,
        intent: str | None = None,
        mode: str | None = None,
        depth: str | None = None,
        verify: bool = False,
    ) -> ClarityResult:
        """Clarity — anti-hallucination answer engine. See sync client for full docs."""
        body: dict[str, Any] = {"prompt": prompt}
        if context is not None:
            body["context"] = context
        if intent is not None:
            body["intent"] = intent
        if mode is not None:
            body["mode"] = mode
        if depth is not None:
            body["depth"] = depth
        elif verify:
            body["verify"] = True
        data = await self._post("/browse/clarity", body)
        return ClarityResult(**data)

    async def get_shared(self, share_id: str) -> dict[str, Any]:
        return await self._get(f"/browse/share/{share_id}")

    async def stats(self) -> dict[str, Any]:
        return await self._get("/browse/stats")

    async def feedback(self, result_id: str, rating: str, claim_index: int | None = None) -> dict[str, Any]:
        """Submit feedback on a result. Rating: 'good', 'bad', or 'wrong'."""
        body: dict[str, Any] = {"resultId": result_id, "rating": rating}
        if claim_index is not None:
            body["claimIndex"] = claim_index
        return await self._post("/browse/feedback", body)

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

    def __init__(self, client: AsyncBrowseAIDev, session: Session):
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
        data = await self._client._get(f"/session/{self.id}/knowledge?limit={limit}")
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
        response = await self._client._client.delete(f"/session/{self.id}")
        _handle_error(response)
        data = response.json()
        if not data.get("success"):
            raise BrowseAIDevError(data.get("error", "Unknown error"))
