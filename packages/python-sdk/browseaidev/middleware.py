"""Verification middleware for AI agent pipelines.

Wraps any LLM output and auto-verifies it through the BrowseAI Dev
Evidence Engine. Works with any LLM provider — framework agnostic.

Usage::

    from browseaidev.middleware import Verifier

    verifier = Verifier(api_key="bai_xxx")

    # Direct verification
    result = verifier.verify("The Earth is 4.5 billion years old.")
    print(result.grade)       # "A"
    print(result.confidence)  # 0.94
    print(result.passed)      # True

    # Decorator — auto-verify any function's output
    @verifier.wrap
    def my_agent(query: str) -> str:
        return openai.chat.completions.create(...).choices[0].message.content

    result = my_agent("What is quantum computing?")
    print(result.text)        # original LLM answer
    print(result.claims)      # per-claim verification
"""

from __future__ import annotations

import asyncio
import functools
import inspect
from typing import Any, Callable, TypeVar, overload

from .client import AsyncBrowseAIDev, BrowseAIDev
from .models import VerificationResult

F = TypeVar("F", bound=Callable[..., Any])


def _extract_text(value: Any) -> str:
    """Extract text from common LLM response objects via duck typing."""
    if isinstance(value, str):
        return value
    # OpenAI ChatCompletion
    if hasattr(value, "choices"):
        choices = value.choices
        if choices and hasattr(choices[0], "message"):
            content = choices[0].message.content
            if content is not None:
                return str(content)
    # Anthropic Message
    if hasattr(value, "content") and isinstance(value.content, list):
        for block in value.content:
            if hasattr(block, "text"):
                return str(block.text)
    # Google Gemini
    if hasattr(value, "text") and not isinstance(value, dict):
        return str(value.text)
    # Dict with common keys
    if isinstance(value, dict):
        for key in ("text", "content", "answer", "output", "response", "message"):
            if key in value and isinstance(value[key], str):
                return value[key]
    return str(value)


class Verifier:
    """Synchronous verification middleware for AI agent pipelines.

    Usage::

        verifier = Verifier(api_key="bai_xxx")
        result = verifier.verify("Some LLM-generated text")
        print(result.grade, result.confidence)

        @verifier.wrap
        def my_agent(query):
            return llm.generate(query)

        result = my_agent("question")  # returns VerificationResult
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        client: BrowseAIDev | None = None,
        depth: str = "fast",
        max_claims: int = 20,
    ):
        if client is not None:
            self._client = client
            self._owns_client = False
        elif api_key is not None:
            self._client = BrowseAIDev(api_key=api_key)
            self._owns_client = True
        else:
            raise ValueError("Either api_key or client must be provided")
        self._depth = depth
        self._max_claims = max_claims

    def verify(
        self,
        text: str,
        *,
        depth: str | None = None,
        max_claims: int | None = None,
    ) -> VerificationResult:
        """Verify text through the Evidence Engine pipeline.

        Args:
            text: The text to verify (50-50000 characters).
            depth: Override default depth ("fast" or "thorough").
            max_claims: Override default max claims (1-50).

        Returns:
            VerificationResult with grade, confidence, and per-claim details.
        """
        raw = self._client.verify_document(
            text=text,
            depth=depth or self._depth,
            max_claims=max_claims or self._max_claims,
        )
        return VerificationResult.from_api_response(text, raw)

    @overload
    def wrap(self, fn: F) -> F: ...
    @overload
    def wrap(self, *, depth: str | None = None, max_claims: int | None = None) -> Callable[[F], F]: ...

    def wrap(
        self,
        fn: F | None = None,
        *,
        depth: str | None = None,
        max_claims: int | None = None,
    ) -> F | Callable[[F], F]:
        """Decorator that auto-verifies a function's return value.

        Works with functions returning strings, OpenAI ChatCompletions,
        Anthropic Messages, or dicts with text/content/answer keys.

        Can be used as ``@verifier.wrap`` or ``@verifier.wrap(depth="thorough")``.
        """
        def decorator(func: F) -> F:
            @functools.wraps(func)
            def wrapper(*args: Any, **kwargs: Any) -> VerificationResult:
                result = func(*args, **kwargs)
                text = _extract_text(result)
                return self.verify(text, depth=depth, max_claims=max_claims)
            return wrapper  # type: ignore[return-value]

        if fn is not None:
            return decorator(fn)
        return decorator

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> Verifier:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


class AsyncVerifier:
    """Async verification middleware for AI agent pipelines.

    Usage::

        async with AsyncVerifier(api_key="bai_xxx") as verifier:
            result = await verifier.verify("Some LLM-generated text")
            print(result.grade, result.confidence)

        @verifier.wrap
        async def my_agent(query):
            return await llm.generate(query)

        result = await my_agent("question")  # returns VerificationResult
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        client: AsyncBrowseAIDev | None = None,
        depth: str = "fast",
        max_claims: int = 20,
    ):
        if client is not None:
            self._client = client
            self._owns_client = False
        elif api_key is not None:
            self._client = AsyncBrowseAIDev(api_key=api_key)
            self._owns_client = True
        else:
            raise ValueError("Either api_key or client must be provided")
        self._depth = depth
        self._max_claims = max_claims

    async def verify(
        self,
        text: str,
        *,
        depth: str | None = None,
        max_claims: int | None = None,
    ) -> VerificationResult:
        """Verify text through the Evidence Engine pipeline.

        Args:
            text: The text to verify (50-50000 characters).
            depth: Override default depth ("fast" or "thorough").
            max_claims: Override default max claims (1-50).

        Returns:
            VerificationResult with grade, confidence, and per-claim details.
        """
        raw = await self._client.verify_document(
            text=text,
            depth=depth or self._depth,
            max_claims=max_claims or self._max_claims,
        )
        return VerificationResult.from_api_response(text, raw)

    @overload
    def wrap(self, fn: F) -> F: ...
    @overload
    def wrap(self, *, depth: str | None = None, max_claims: int | None = None) -> Callable[[F], F]: ...

    def wrap(
        self,
        fn: F | None = None,
        *,
        depth: str | None = None,
        max_claims: int | None = None,
    ) -> F | Callable[[F], F]:
        """Decorator that auto-verifies an async function's return value.

        Can be used as ``@verifier.wrap`` or ``@verifier.wrap(depth="thorough")``.
        """
        def decorator(func: F) -> F:
            @functools.wraps(func)
            async def wrapper(*args: Any, **kwargs: Any) -> VerificationResult:
                result = await func(*args, **kwargs)
                text = _extract_text(result)
                return await self.verify(text, depth=depth, max_claims=max_claims)
            return wrapper  # type: ignore[return-value]

        if fn is not None:
            return decorator(fn)
        return decorator

    async def close(self) -> None:
        if self._owns_client:
            await self._client.close()

    async def __aenter__(self) -> AsyncVerifier:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
