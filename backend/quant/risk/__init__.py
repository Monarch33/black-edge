"""
Black Edge V2 - Risk Management
Portfolio Kelly sizing, trailing stops, and cross-platform arbitrage detection.
"""

from .manager import (
    RiskManager,
    TrailingStop,
    CorrelationTracker,
    portfolio_kelly,
    detect_arb_opportunity,
    KellyWeights,
    ArbOpportunity,
)

__all__ = [
    'RiskManager',
    'TrailingStop',
    'CorrelationTracker',
    'portfolio_kelly',
    'detect_arb_opportunity',
    'KellyWeights',
    'ArbOpportunity',
]
