"""
Black Edge Engine
=================
Core modules for arbitrage detection, blockchain interaction,
live Polymarket data, and quantitative analysis.
"""

from .math_core import (
    ArbitrageDetector,
    ArbitrageOpportunity,
    ArbitrageType,
    MarketState,
    MarginalPolytope,
    OptimalTradeCalculator,
)
from .polymarket import PolymarketClient, PolymarketMarket
from .analytics import QuantEngine, QuantSignal

__all__ = [
    "ArbitrageDetector",
    "ArbitrageOpportunity",
    "ArbitrageType",
    "MarketState",
    "MarginalPolytope",
    "OptimalTradeCalculator",
    "PolymarketClient",
    "PolymarketMarket",
    "QuantEngine",
    "QuantSignal",
]
