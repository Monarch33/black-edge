"""
Schémas Pydantic — Output LLM
=============================
Structure stricte pour la réponse de l'agent IA.
"""

from pydantic import BaseModel, Field


class AgentAnalysis(BaseModel):
    """
    Réponse validée de l'agent LLM.
    Si le JSON est mal formaté → trade annulé (fail-safe).
    """

    market_id: str = Field(..., description="ID du marché Polymarket")
    ia_probability: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Probabilité réelle estimée par l'IA (YES)",
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Niveau de confiance de l'IA (0-1)",
    )
    reasoning: str = Field(..., description="Explication concise du raisonnement")
    recommended_side: str = Field(
        ...,
        description="YES ou NO — côté recommandé",
    )


class AlphaSignal(BaseModel):
    """Signal Alpha : décalage IA vs Marché suffisant pour agir."""

    market_id: str
    market_question: str
    market_probability: float
    ia_probability: float
    alpha_pct: float  # |IA - Marché| en %
    confidence_score: float
    side: str  # YES ou NO
    reasoning: str
