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
        # Build real WorldState from live data
        world_state = await state.build_real_world_state(market_id)

        if not world_state:
            raise HTTPException(
                status_code=404,
                detail=f"Market {market_id} not found"
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

@router.get("/crypto/5min/signals")
async def get_5min_signals() -> dict:
    """
    Get current 5-minute BTC latency arbitrage signals.

    Returns:
        Active markets and any detected arbitrage signals
    """
    from main import state
    import time

    if not state.crypto_5min_scanner:
        raise HTTPException(status_code=503, detail="5-min scanner not initialized")

    try:
        markets = state.crypto_5min_scanner._active_markets
        signals = await state.crypto_5min_scanner.scan_for_signals()

        return {
            "active_markets": [
                {
                    "slug": m.slug,
                    "question": m.question,
                    "interval": m.interval_minutes,
                    "upPrice": round(m.up_price, 3),
                    "downPrice": round(m.down_price, 3),
                    "timeRemaining": round(m.time_remaining_seconds),
                    "volume": round(m.volume, 2),
                }
                for m in markets
            ],
            "signals": [
                {
                    "market": s.market_slug,
                    "slug": s.market_slug,
                    "question": s.question,
                    "direction": s.direction,
                    "btcMove": round(s.binance_move_pct, 3),
                    "marketPrice": round(s.polymarket_up_price, 3),
                    "trueProbability": round(s.estimated_true_prob, 3),
                    "edge": round(s.edge, 3),
                    "confidence": s.confidence,
                    "timeRemaining": round(s.time_remaining_seconds),
                    "recommendedSide": s.recommended_side,
                    "tokenId": s.recommended_token_id,
                    "volume": round(s.volume, 2),
                }
                for s in signals
            ],
            "btcPrice": round(state.crypto_5min_scanner._btc_price, 2),
            "timestamp": time.time(),
        }

    except Exception as e:
        logger.error("Failed to get 5min signals", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/signals")
async def get_all_signals() -> dict:
    """
    Get all active trading signals across all markets.

    Returns enriched signals with predictions for YES/NO, edge analysis,
    volume data, and confidence metrics. Used by Sports and general views.
    """
    from main import state
    import time

    try:
        # Get live signals from state
        signals = []

        for signal in state.live_signals:
            api_dict = signal.to_api_dict()

            # Add prediction field (YES if positive edge, NO otherwise)
            api_dict["prediction"] = "YES" if signal.kelly_edge > 0 else "NO"

            signals.append(api_dict)

        logger.debug("✅ Serving REAL Polymarket data", signal_count=len(signals))

        return {
            "status": "success",
            "signals": signals,
            "count": len(signals),
            "timestamp": time.time(),
        }

    except Exception as e:
        logger.error("Failed to get signals", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/track-record")
async def get_track_record() -> dict:
    """
    Public track record endpoint.

    Returns performance statistics from paper trading logger:
    - Total predictions made
    - Win rate (%)
    - Average edge predicted vs realized
    - Total P&L (paper)
    - Confidence breakdown
    - Recent predictions (last 10)
    """
    try:
        from engine.paper_trading_logger import get_track_record

        stats = get_track_record()

        return {
            "status": "success",
            "track_record": {
                "summary": {
                    "total_predictions": stats["total_predictions"],
                    "total_resolved": stats["total_resolved"],
                    "win_rate": round(stats["win_rate"] * 100, 1),  # Convert to %
                    "avg_edge_predicted": round(stats["avg_edge_predicted"] * 100, 1),
                    "avg_edge_realized": round(stats["avg_edge_realized"] * 100, 1),
                    "total_pnl": round(stats["total_pnl"], 2),
                },
                "by_confidence": stats["confidence_breakdown"],
                "recent_predictions": stats["recent_predictions"],
            },
            "timestamp": time.time(),
        }

    except Exception as e:
        logger.error("Failed to get track record", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


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
        'crypto_5min_scanner': state.crypto_5min_scanner is not None,
        'news_collector': state.news_collector is not None,
    }

    all_healthy = all(components.values())

    return {
        'status': 'healthy' if all_healthy else 'degraded',
        'components': components,
        'timestamp': datetime.utcnow().isoformat()
    }
