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
    published_date: str | None = Field(None, alias="publishedDate")

    model_config = {"populate_by_name": True}


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


class ReasoningStep(BaseModel):
    """Multi-step reasoning step (deep mode only)."""
    step: int
    query: str
    gap_analysis: str = Field(alias="gapAnalysis")
    claim_count: int = Field(alias="claimCount")
    confidence: float

    model_config = {"populate_by_name": True}


class BrowseResult(BaseModel):
    answer: str
    claims: list[BrowseClaim]
    sources: list[BrowseSource]
    confidence: float = Field(ge=0, le=1)
    trace: list[TraceStep] = []
    contradictions: list[Contradiction] | None = None
    reasoning_steps: list[ReasoningStep] | None = Field(None, alias="reasoningSteps")
    share_id: str | None = Field(None, alias="shareId")
    effective_depth: str | None = Field(None, alias="effectiveDepth")

    model_config = {"populate_by_name": True}


class ClarityClaim(BaseModel):
    """A claim from Clarity with origin tracking."""
    claim: str
    origin: Literal["llm", "source", "confirmed"]
    sources: list[str] = []
    verified: bool | None = None
    verification_score: float | None = Field(None, alias="verificationScore")

    model_config = {"populate_by_name": True}


class ClarityResult(BaseModel):
    """Clarity — anti-hallucination answer engine result.

    Three modes:
    - mode="prompt": Returns only enhanced system + user prompts. No LLM call, no internet.
      Use when your own LLM (e.g. Claude) should answer using the anti-hallucination prompts.
    - mode="answer" (default): LLM-only answer with anti-hallucination techniques. Fast, no internet.
    - mode="verified": LLM answer + web-verified pipeline, fused into one answer with source-backed claims.
    """
    original: str
    intent: Literal["factual_question", "document_qa", "content_generation", "agent_pipeline", "code_generation", "general"]
    answer: str
    claims: list[ClarityClaim] = []
    sources: list[BrowseSource] = []
    confidence: float = Field(ge=0, le=1)
    techniques: list[str]
    risks: list[str] = []
    verified: bool = False
    mode: Literal["prompt", "answer", "verified"] = "answer"
    trace: list[TraceStep] = []
    system_prompt: str = Field(alias="systemPrompt")
    user_prompt: str = Field(alias="userPrompt")
    contradictions: list[Contradiction] | None = None

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
    resets_in_seconds: int | None = Field(default=None, alias="resetsInSeconds")

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
    provider: str = "raw_llm"
    label: str = "Raw LLM"
    answer: str
    sources: int = 0
    citations: list[dict[str, str]] = []
    latency_ms: int = 0


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
    provider: str = "raw_llm"
    competitor: CompareRawLLM = Field(alias="competitor")
    evidence_backed: CompareEvidenceBacked

    model_config = {"populate_by_name": True}


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
