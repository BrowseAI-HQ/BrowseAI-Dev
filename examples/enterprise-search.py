"""
Enterprise Search — BrowseAI Example

Use BrowseAI Dev with your own data sources (Elasticsearch, Confluence,
or any custom endpoint) instead of — or alongside — public web search.

Supports zero data retention mode for compliance-sensitive environments.

Usage:
    pip install browseai
    BROWSEAI_API_KEY=bai_xxx python enterprise-search.py
"""

import os
from browseai import BrowseAI


def main():
    api_key = os.environ.get("BROWSEAI_API_KEY", "bai_xxx")
    client = BrowseAI(api_key=api_key)

    # ── Elasticsearch ──
    # Point BrowseAI at your Elasticsearch cluster
    result = client.ask(
        "What is our refund policy?",
        search_provider={
            "type": "elasticsearch",
            "endpoint": "https://es.internal.company.com/knowledge-base/_search",
            "authHeader": "Bearer es-token-xxx",
            "index": "docs",
        },
    )
    print(f"ES Answer: {result.answer}")
    print(f"Confidence: {result.confidence:.0%}\n")

    # ── Confluence ──
    # Search your Confluence wiki
    result = client.ask(
        "How do we handle PCI compliance?",
        search_provider={
            "type": "confluence",
            "endpoint": "https://company.atlassian.net/wiki/rest/api",
            "authHeader": "Basic base64-encoded-credentials",
            "spaceKey": "ENG",
        },
    )
    print(f"Confluence Answer: {result.answer}")
    print(f"Confidence: {result.confidence:.0%}\n")

    # ── Custom endpoint ──
    # Any endpoint that returns { results: [{ url, title, snippet }] }
    result = client.ask(
        "Latest incident reports",
        search_provider={
            "type": "custom",
            "endpoint": "https://api.internal.company.com/search",
            "authHeader": "Bearer custom-token-xxx",
        },
    )
    print(f"Custom Answer: {result.answer}")
    print(f"Confidence: {result.confidence:.0%}\n")

    # ── Zero data retention ──
    # For compliance — nothing is stored, cached, or logged
    result = client.ask(
        "Patient treatment protocols for condition X",
        search_provider={
            "type": "elasticsearch",
            "endpoint": "https://es.hipaa.company.com/medical/_search",
            "authHeader": "Bearer es-token-xxx",
            "dataRetention": "none",  # Zero storage mode
        },
    )
    print(f"HIPAA Answer: {result.answer}")
    print(f"Confidence: {result.confidence:.0%}")
    print("Data retention: none (zero storage mode)")


if __name__ == "__main__":
    main()
