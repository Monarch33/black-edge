"""
Black Edge V2 - REST API Routes
================================
REST endpoints for quant signals, features, narrative, whales, risk, and council.

Endpoints:
- GET /api/v2/signal/{market_id} - Latest signal for a market
- GET /api/v2/features/{market_id} - Feature vector for a market
- GET /api/v2/narrative/{market_id} - Narrative signal for a market
- GET /api/v2/whales/top - Top N whales by performance
- GET /api/v2/risk/portfolio - Portfolio state + active stops
- GET /api/v2/council/{market_id} - Force Council vote, return decision
- POST /api/v2/headlines - Ingest headline into FeatureEngineer + NVI
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import structlog

logger = structlog.get_logger()

# Create router
router = APIRouter(prefix="/api/v2", tags=["v2"])


# =============================================================================
# Request/Response Models
# =============================================================================

class HeadlineRequest(BaseModel):
    """Request body for headline ingestion."""
    text: str
    market_id: str
    source: Optional[str] = "api"


class SignalResponse(BaseModel):
    """Response model for signal endpoint."""
    market_id: str
    signal: str
    edge: float
    confidence: float
    timestamp: str


# =============================================================================
# Routes
# =============================================================================

@router.get("/signal/{market_id}")
async def get_signal(market_id: str) -> dict:
    """
    Get the latest trading signal for a market.

    Returns:
        SignalOutput as JSON with signal, edge, confidence, etc.
    """
    from main import state

    if not state.quant_model:
        raise HTTPException(status_code=503, detail="QuantModel not initialized")

    try:
        # Get features for market
        features = state.feature_engineer.compute(market_id)

        if not features or not features.is_valid:
            raise HTTPException(
                status_code=404,
                detail=f"No valid features for market {market_id}"
            )

        # Get narrative signal
        narrative = state.narrative_velocity.compute_signal(market_id)

        # Check whale alignment
        whale_aligned = False  # TODO: Integrate with whale tracker

        # Compute signal
        signal_output = state.quant_model.compute_signal(
            features=features,
            narrative=narrative,
            whale_is_aligned=whale_aligned
        )

        # Convert to dict
        result = asdict(signal_output)
        result['timestamp'] = datetime.utcnow().isoformat()

        return result

    except Exception as e:
        logger.error("Failed to compute signal", market_id=market_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{market_id}")
async def get_features(market_id: str) -> dict:
    """
    Get the latest feature vector for a market.

    Returns:
        FeatureVector as JSON with OBI, volume_z_score, IV, momentum, sentiment.
    """
    from main import state

    if not state.feature_engineer:
        raise HTTPException(status_code=503, detail="FeatureEngineer not initialized")

    try:
        features = state.feature_engineer.compute(market_id)

        if not features or not features.is_valid:
            raise HTTPException(
                status_code=404,
                detail=f"No valid features for market {market_id}"
            )

        result = asdict(features)
        return result

    except Exception as e:
        logger.error("Failed to compute features", market_id=market_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/narrative/{market_id}")
async def get_narrative(market_id: str) -> dict:
    """
    Get the narrative velocity signal for a market.

    Returns:
        NarrativeSignal as JSON with NVI score, z-score, is_accelerating.
    """
    from main import state

    if not state.narrative_velocity:
        raise HTTPException(status_code=503, detail="NarrativeVelocity not initialized")

    try:
        narrative = state.narrative_velocity.compute_signal(market_id)

        if not narrative:
            raise HTTPException(
                status_code=404,
                detail=f"No narrative data for market {market_id}"
            )

        result = asdict(narrative)
        return result

    except Exception as e:
        logger.error("Failed to compute narrative", market_id=market_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/whales/top")
async def get_top_whales(n: int = Query(10, ge=1, le=100)) -> dict:
    """
    Get top N whales by performance.

    Args:
        n: Number of whales to return (default 10, max 100)

    Returns:
        List of top N whales with address, total_pnl, sharpe_ratio, win_rate.
    """
    from main import state

    if not state.whale_watchlist:
        raise HTTPException(status_code=503, detail="WhaleWatchlist not initialized")

    try:
        top_whales = state.whale_watchlist.top_n(n)

        whales_data = []
        for whale in top_whales:
            whales_data.append({
                'address': whale.address,
                'total_pnl_usd': whale.total_pnl_usd,
                'sharpe_ratio': whale.sharpe_ratio,
                'win_rate': whale.win_rate,
                'trade_count': whale.trade_count,
                'last_trade_ts': whale.last_trade_ts,
                'rank': whale.rank
            })

        return {
            'count': len(whales_data),
            'whales': whales_data,
            'timestamp': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Failed to get top whales", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/risk/portfolio")
async def get_portfolio_risk() -> dict:
    """
    Get current portfolio risk state.

    Returns:
        Portfolio state with active stops, correlations, and risk metrics.
    """
    from main import state

    if not state.risk_manager:
        raise HTTPException(status_code=503, detail="RiskManager not initialized")

    try:
        # Get active stops
        active_stops = state.risk_manager.get_active_stops()

        stops_data = []
        for position_id, stop in active_stops.items():
            stops_data.append({
                'position_id': position_id,
                'entry_price': stop.entry_price,
                'high_water_mark': stop.high_water_mark,
                'stop_pct': stop.stop_pct,
                'is_triggered': stop.is_triggered
            })

        # Get correlated pairs
        correlated_pairs = state.risk_manager.get_correlated_pairs(threshold=0.65)

        pairs_data = []
        for market_a, market_b, corr in correlated_pairs[:10]:  # Top 10
            pairs_data.append({
                'market_a': market_a,
                'market_b': market_b,
                'correlation': round(corr, 3)
            })

        return {
            'active_stops_count': len(stops_data),
            'active_stops': stops_data,
            'correlated_pairs_count': len(correlated_pairs),
            'correlated_pairs': pairs_data,
            'timestamp': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Failed to get portfolio risk", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/council/{market_id}")
async def get_council_decision(market_id: str) -> dict:
    """
    Force a Council vote for a market and return the decision.

    Returns:
        CouncilDecision with votes from all agents (Sniper, Narrative, WhaleHunter, Doomer, Judge).
    """
    from main import state

    if not state.council:
        raise HTTPException(status_code=503, detail="TheCouncil not initialized")

    try:
        # Build WorldState for this market
        # NOTE: In production, this should fetch real data
        # For now, use mock data for testing

        from quant.council.agents import (
            WorldState, MarketMicrostructure, NarrativeState,
            OnChainState, PortfolioState
        )

        # Mock WorldState (replace with real data in production)
        world_state = WorldState(
            market_id=market_id,
            timestamp_ms=int(datetime.utcnow().timestamp() * 1000),
            mid_price=0.50,
            micro=MarketMicrostructure(
                order_book_imbalance=0.15,
                volume_z_score=1.5,
                momentum_1h=0.05,
                momentum_4h=0.08,
                momentum_24h=0.12,
                spread_bps=400,
                liquidity_depth_usd=50000.0,
                price_reversion_score=0.3
            ),
            narrative=NarrativeState(
                sentiment_score=0.3,
                nvi_score=0.5,
                novelty_index=0.7,
                credibility_factor=0.8,
                sarcasm_probability=0.1,
                tweet_volume_z=1.2,
                narrative_coherence=0.75
            ),
            on_chain=OnChainState(
                smart_money_flow=0.2,
                whale_concentration=0.35,
                retail_flow=-0.1,
                cross_platform_spread=0.02,
                gas_congestion_pct=0.45
            ),
            portfolio=PortfolioState(
                current_drawdown=0.05,
                correlated_exposure=0.25,
                leverage=0.30,
                sharpe_ratio=1.8,
                win_rate=0.65,
                time_to_resolution_hours=72.0,
                implied_volatility=0.25
            )
        )

        # Execute Council vote
        decision = await state.council.convene(world_state)

        # Convert to dict
        result = asdict(decision)
        result['timestamp'] = datetime.utcnow().isoformat()

        return result

    except Exception as e:
        logger.error("Failed to get council decision", market_id=market_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/headlines")
async def ingest_headline(request: HeadlineRequest) -> dict:
    """
    Ingest a headline into FeatureEngineer and NarrativeVelocity.

    Args:
        request: HeadlineRequest with text, market_id, source

    Returns:
        Success status with updated narrative signal
    """
    from main import state

    if not state.feature_engineer or not state.narrative_velocity:
        raise HTTPException(
            status_code=503,
            detail="FeatureEngineer or NarrativeVelocity not initialized"
        )

    try:
        timestamp_ms = int(datetime.utcnow().timestamp() * 1000)

        # Ingest into sentiment analyzer (via feature engineer)
        state.feature_engineer.ingest_headline(
            market_id=request.market_id,
            headline_text=request.text,
            timestamp_ms=timestamp_ms
        )

        # Ingest into narrative velocity
        state.narrative_velocity.ingest_headline(
            headline_text=request.text,
            market_id=request.market_id,
            timestamp_ms=timestamp_ms
        )

        # Compute updated narrative signal
        narrative = state.narrative_velocity.compute_signal(request.market_id)

        logger.info(
            "Headline ingested",
            market_id=request.market_id,
            text_length=len(request.text),
            nvi_score=narrative.nvi_score if narrative else None
        )

        return {
            'status': 'success',
            'market_id': request.market_id,
            'headline_length': len(request.text),
            'narrative': asdict(narrative) if narrative else None,
            'timestamp': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(
            "Failed to ingest headline",
            market_id=request.market_id,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Health Check
# =============================================================================

@router.get("/health")
async def health_check() -> dict:
    """V2 health check with component status."""
    from main import state

    components = {
        'feature_engineer': state.feature_engineer is not None,
        'narrative_velocity': state.narrative_velocity is not None,
        'whale_watchlist': state.whale_watchlist is not None,
        'quant_model': state.quant_model is not None,
        'council': state.council is not None,
        'risk_manager': state.risk_manager is not None,
    }

    all_healthy = all(components.values())

    return {
        'status': 'healthy' if all_healthy else 'degraded',
        'components': components,
        'timestamp': datetime.utcnow().isoformat()
    }
