"""Pydantic models matching @browse/shared types."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class BrowseSource(BaseModel):
    url: str
    title: str
    domain: str
    quote: str
    verified: bool | None = None
    authority: float | None = None


class NLIScore(BaseModel):
    """NLI semantic entailment score."""
    entailment: float
    contradiction: float
    neutral: float
    label: Literal["entailment", "neutral", "contradiction"]


class BrowseClaim(BaseModel):
    claim: str
    sources: list[str]
    verified: bool | None = None
    verification_score: float | None = Field(None, alias="verificationScore")
    consensus_count: int | None = Field(None, alias="consensusCount")
    consensus_level: Literal["strong", "moderate", "weak", "none"] | None = Field(None, alias="consensusLevel")
    nli_score: NLIScore | None = Field(None, alias="nliScore")

    model_config = {"populate_by_name": True}


class TraceStep(BaseModel):
    step: str
    duration_ms: int
    detail: str | None = None


class Contradiction(BaseModel):
    claim_a: str = Field(alias="claimA")
    claim_b: str = Field(alias="claimB")
    topic: str
    nli_confidence: float | None = Field(None, alias="nliConfidence")

    model_config = {"populate_by_name": True}


class BrowseResult(BaseModel):
    answer: str
    claims: list[BrowseClaim]
    sources: list[BrowseSource]
    confidence: float = Field(ge=0, le=1)
    trace: list[TraceStep] = []
    contradictions: list[Contradiction] | None = None
    share_id: str | None = Field(None, alias="shareId")

    model_config = {"populate_by_name": True}


class SearchProviderConfig(BaseModel):
    """Enterprise search provider configuration."""
    type: Literal["tavily", "brave", "elasticsearch", "confluence", "custom"]
    endpoint: str | None = None
    auth_header: str | None = Field(None, alias="authHeader")
    index: str | None = None
    space_key: str | None = Field(None, alias="spaceKey")
    data_retention: Literal["normal", "none"] | None = Field("normal", alias="dataRetention")

    model_config = {"populate_by_name": True}


class PremiumQuota(BaseModel):
    """Premium verification quota info returned with answer responses."""
    used: int
    limit: int
    premium_active: bool = Field(alias="premiumActive")

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


# ── Research Memory models ──


class Session(BaseModel):
    id: str
    name: str
    user_id: str | None = Field(None, alias="userId")
    claim_count: int = Field(0, alias="claimCount")
    query_count: int = Field(0, alias="queryCount")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")

    model_config = {"populate_by_name": True}


class KnowledgeEntry(BaseModel):
    id: str
    session_id: str = Field(alias="sessionId")
    claim: str
    sources: list[str]
    verified: bool = False
    confidence: float = 0
    origin_query: str = Field(alias="originQuery")
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


class SessionAskResult(BrowseResult):
    """BrowseResult extended with session metadata."""
    session: dict | None = None


class RecallResult(BaseModel):
    session: dict
    entries: list[KnowledgeEntry]
    count: int
