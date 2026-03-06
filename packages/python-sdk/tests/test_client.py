"""Basic tests for BrowseAI client."""

import pytest

from browseai import BrowseAI, AsyncBrowseAI, BrowseAIError
from browseai.models import BrowseResult, SearchResult, PageResult, CompareResult


def test_client_requires_auth():
    with pytest.raises(ValueError, match="Provide api_key"):
        BrowseAI()


def test_async_client_requires_auth():
    with pytest.raises(ValueError, match="Provide api_key"):
        AsyncBrowseAI()


def test_client_accepts_api_key():
    client = BrowseAI(api_key="bai_test")
    assert client._headers["X-API-Key"] == "bai_test"
    client.close()


def test_client_accepts_byok():
    client = BrowseAI(tavily_key="tvly-xxx", openrouter_key="sk-or-xxx")
    assert client._headers["X-Tavily-Key"] == "tvly-xxx"
    assert client._headers["X-OpenRouter-Key"] == "sk-or-xxx"
    client.close()


def test_client_context_manager():
    with BrowseAI(api_key="bai_test") as client:
        assert client is not None


def test_models_parse():
    data = {
        "answer": "Test answer",
        "claims": [{"claim": "Test claim", "sources": ["https://example.com"]}],
        "sources": [{"url": "https://example.com", "title": "Example", "domain": "example.com", "quote": "test"}],
        "confidence": 0.85,
        "trace": [{"step": "Search", "duration_ms": 100}],
    }
    result = BrowseResult(**data)
    assert result.answer == "Test answer"
    assert result.confidence == 0.85
    assert len(result.sources) == 1
    assert result.sources[0].domain == "example.com"


def test_search_result_model():
    data = {"url": "https://example.com", "title": "Example", "snippet": "A snippet", "score": 0.9}
    result = SearchResult(**data)
    assert result.score == 0.9


def test_page_result_model():
    data = {"title": "Example", "content": "Page content", "excerpt": "Short", "siteName": "Example Site"}
    result = PageResult(**data)
    assert result.site_name == "Example Site"
