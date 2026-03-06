"""Pydantic models matching @browse/shared types."""

from __future__ import annotations

from pydantic import BaseModel, Field


class BrowseSource(BaseModel):
    url: str
    title: str
    domain: str
    quote: str


class BrowseClaim(BaseModel):
    claim: str
    sources: list[str]


class TraceStep(BaseModel):
    step: str
    duration_ms: int
    detail: str | None = None


class BrowseResult(BaseModel):
    answer: str
    claims: list[BrowseClaim]
    sources: list[BrowseSource]
    confidence: float = Field(ge=0, le=1)
    trace: list[TraceStep]
    share_id: str | None = Field(None, alias="shareId")

    model_config = {"populate_by_name": True}


class SearchResult(BaseModel):
    url: str
    title: str
    snippet: str
    score: float


class PageResult(BaseModel):
    title: str
    content: str
    excerpt: str
    site_name: str | None = Field(None, alias="siteName")
    byline: str | None = None

    model_config = {"populate_by_name": True}


class CompareRawLLM(BaseModel):
    answer: str
    sources: int
    claims: int
    confidence: float | None


class CompareEvidenceBacked(BaseModel):
    answer: str
    sources: int
    claims: int
    confidence: float
    citations: list[BrowseSource]
    claim_details: list[BrowseClaim] = Field(alias="claimDetails")
    trace: list[TraceStep]

    model_config = {"populate_by_name": True}


class CompareResult(BaseModel):
    query: str
    raw_llm: CompareRawLLM
    evidence_backed: CompareEvidenceBacked
