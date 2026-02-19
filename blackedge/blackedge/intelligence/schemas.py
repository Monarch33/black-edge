"""Pydantic v2 schemas for structured LLM output."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MarketSignal(BaseModel):
    """Strictly-typed output the LLM must produce for every market."""

    market_id: str
    ia_probability: float = Field(
        ge=0.0,
        le=1.0,
        description="The AI's estimated true probability (0-1).",
    )
    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
        description="How confident the AI is in its own estimate (0-1).",
    )
    recommended_side: str = Field(
        description="'YES' or 'NO' — the side the AI recommends.",
    )
    reasoning: str = Field(
        description="One-paragraph justification.",
    )
