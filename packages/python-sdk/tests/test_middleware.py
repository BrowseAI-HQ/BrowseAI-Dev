"""Tests for the verification middleware."""

from __future__ import annotations

from unittest.mock import MagicMock, AsyncMock, patch

import pytest

from browseaidev import Verifier, AsyncVerifier, VerificationResult, VerifiedClaim
from browseaidev.middleware import _extract_text


# ── _extract_text tests ──


def test_extract_text_string():
    assert _extract_text("hello") == "hello"


def test_extract_text_openai_response():
    msg = MagicMock()
    msg.content = "LLM answer"
    choice = MagicMock()
    choice.message = msg
    response = MagicMock()
    response.choices = [choice]
    assert _extract_text(response) == "LLM answer"


def test_extract_text_anthropic_response():
    block = MagicMock()
    block.text = "Claude answer"
    response = MagicMock(spec=[])
    response.content = [block]
    assert _extract_text(response) == "Claude answer"


def test_extract_text_gemini_response():
    response = MagicMock(spec=[])
    response.text = "Gemini answer"
    assert _extract_text(response) == "Gemini answer"


def test_extract_text_dict_answer():
    assert _extract_text({"answer": "from dict"}) == "from dict"


def test_extract_text_dict_content():
    assert _extract_text({"content": "from dict"}) == "from dict"


def test_extract_text_dict_text():
    assert _extract_text({"text": "from dict"}) == "from dict"


def test_extract_text_fallback():
    assert _extract_text(42) == "42"


# ── VerificationResult model tests ──


MOCK_API_RESPONSE = {
    "grade": "B",
    "overallScore": 0.78,
    "claims": [
        {
            "claim": "Python was created in 1991",
            "verified": True,
            "verificationScore": 0.92,
            "sources": ["https://python.org"],
        },
        {
            "claim": "Python is the fastest language",
            "verified": False,
            "verificationScore": 0.15,
            "sources": [],
        },
        {
            "claim": "Python uses indentation",
            "verified": None,
            "verificationScore": 0.45,
            "sources": ["https://docs.python.org"],
        },
    ],
}


def test_verification_result_from_api():
    result = VerificationResult.from_api_response("test text", MOCK_API_RESPONSE)
    assert result.text == "test text"
    assert result.grade == "B"
    assert result.confidence == 0.78
    assert result.total_claims == 3
    assert result.verified_count == 1
    assert result.contradicted_count == 1
    assert result.unverified_count == 1
    assert result.passed is True


def test_verification_result_failing_grade():
    raw = {"grade": "F", "overallScore": 0.2, "claims": []}
    result = VerificationResult.from_api_response("bad text", raw)
    assert result.passed is False


def test_verification_result_empty():
    result = VerificationResult.from_api_response("text", {})
    assert result.grade == "?"
    assert result.confidence == 0.0
    assert result.total_claims == 0
    assert result.passed is False


def test_verified_claim_statuses():
    result = VerificationResult.from_api_response("text", MOCK_API_RESPONSE)
    statuses = [c.status for c in result.claims]
    assert statuses == ["verified", "contradicted", "unverified"]


# ── Verifier class tests ──


def test_verifier_requires_key_or_client():
    with pytest.raises(ValueError, match="Either api_key or client"):
        Verifier()


def test_verifier_with_api_key():
    v = Verifier(api_key="bai_test")
    assert v._owns_client is True
    v.close()


def test_verifier_with_client():
    from browseaidev import BrowseAIDev
    client = BrowseAIDev(api_key="bai_test")
    v = Verifier(client=client)
    assert v._owns_client is False
    v.close()
    client.close()


def test_verifier_context_manager():
    with Verifier(api_key="bai_test") as v:
        assert v is not None


def test_verifier_verify():
    mock_client = MagicMock()
    mock_client.verify_document.return_value = MOCK_API_RESPONSE

    v = Verifier(client=mock_client)
    result = v.verify("test text")

    mock_client.verify_document.assert_called_once_with(
        text="test text", depth="fast", max_claims=20
    )
    assert isinstance(result, VerificationResult)
    assert result.grade == "B"


def test_verifier_verify_custom_params():
    mock_client = MagicMock()
    mock_client.verify_document.return_value = MOCK_API_RESPONSE

    v = Verifier(client=mock_client, depth="thorough", max_claims=10)
    v.verify("text", depth="fast", max_claims=5)

    mock_client.verify_document.assert_called_once_with(
        text="text", depth="fast", max_claims=5
    )


def test_verifier_wrap_bare():
    mock_client = MagicMock()
    mock_client.verify_document.return_value = MOCK_API_RESPONSE

    v = Verifier(client=mock_client)

    @v.wrap
    def my_fn() -> str:
        return "LLM output"

    result = my_fn()
    assert isinstance(result, VerificationResult)
    assert result.text == "LLM output"


def test_verifier_wrap_with_params():
    mock_client = MagicMock()
    mock_client.verify_document.return_value = MOCK_API_RESPONSE

    v = Verifier(client=mock_client)

    @v.wrap(depth="thorough")
    def my_fn() -> str:
        return "LLM output"

    result = my_fn()
    mock_client.verify_document.assert_called_once_with(
        text="LLM output", depth="thorough", max_claims=None
    )


def test_verifier_wrap_preserves_name():
    v = Verifier(api_key="bai_test")

    @v.wrap
    def my_agent_fn():
        return "text"

    assert my_agent_fn.__name__ == "my_agent_fn"
    v.close()


def test_verifier_wrap_extracts_from_openai():
    mock_client = MagicMock()
    mock_client.verify_document.return_value = MOCK_API_RESPONSE

    v = Verifier(client=mock_client)

    msg = MagicMock()
    msg.content = "OpenAI answer"
    choice = MagicMock()
    choice.message = msg
    openai_response = MagicMock()
    openai_response.choices = [choice]

    @v.wrap
    def my_fn():
        return openai_response

    result = my_fn()
    mock_client.verify_document.assert_called_once_with(
        text="OpenAI answer", depth="fast", max_claims=20
    )


# ── AsyncVerifier tests ──


def test_async_verifier_requires_key_or_client():
    with pytest.raises(ValueError, match="Either api_key or client"):
        AsyncVerifier()


@pytest.mark.asyncio
async def test_async_verifier_verify():
    mock_client = AsyncMock()
    mock_client.verify_document.return_value = MOCK_API_RESPONSE

    v = AsyncVerifier(client=mock_client)
    result = await v.verify("test text")

    mock_client.verify_document.assert_called_once_with(
        text="test text", depth="fast", max_claims=20
    )
    assert isinstance(result, VerificationResult)
    assert result.grade == "B"


@pytest.mark.asyncio
async def test_async_verifier_wrap():
    mock_client = AsyncMock()
    mock_client.verify_document.return_value = MOCK_API_RESPONSE

    v = AsyncVerifier(client=mock_client)

    @v.wrap
    async def my_fn() -> str:
        return "async LLM output"

    result = await my_fn()
    assert isinstance(result, VerificationResult)
    assert result.text == "async LLM output"


@pytest.mark.asyncio
async def test_async_verifier_context_manager():
    v = AsyncVerifier(api_key="bai_test")
    async with v as verifier:
        assert verifier is not None
