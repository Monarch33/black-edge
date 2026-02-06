"""
Black Edge Engine
=================
Core modules for arbitrage detection, blockchain interaction,
live Polymarket data, and quantitative analysis.
"""

# Core imports (no numpy required)
from .polymarket import PolymarketClient, PolymarketMarket
from .analytics import QuantEngine, QuantSignal

# Optional imports (require numpy/pandas/scipy)
try:
    from .math_core import (
        ArbitrageDetector,
        ArbitrageOpportunity,
        ArbitrageType,
        MarketState,
        MarginalPolytope,
        OptimalTradeCalculator,
    )
    _MATH_CORE_AVAILABLE = True
except ImportError:
    ArbitrageDetector = None
    ArbitrageOpportunity = None
    ArbitrageType = None
    MarketState = None
    MarginalPolytope = None
    OptimalTradeCalculator = None
    _MATH_CORE_AVAILABLE = False

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
