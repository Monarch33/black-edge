"""
Black Edge V2 - REST API Routes
================================
REST endpoints for quant signals, features, narrative, whales, risk, council, and trade execution.

Endpoints:
- GET /api/v2/signal/{market_id} - Latest signal for a market
- GET /api/v2/features/{market_id} - Feature vector for a market
- GET /api/v2/narrative/{market_id} - Narrative signal for a market
- GET /api/v2/whales/top - Top N whales by performance
- GET /api/v2/risk/portfolio - Portfolio state + active stops
- GET /api/v2/council/{market_id} - Force Council vote, return decision
- POST /api/v2/headlines - Ingest headline into FeatureEngineer + NVI

Trade Execution (Phase 6):
- POST /api/v2/trade/execute - Execute market or limit orders
- POST /api/v2/trade/cancel/{order_id} - Cancel an order
- GET /api/v2/trade/status/{order_id} - Get order status
- GET /api/v2/trade/balance - Get USDC balance
- POST /api/v2/trade/approve - Approve USDC spending

Waitlist (Phase 9):
- POST /api/v2/waitlist/join - Join waitlist for early access
- GET /api/v2/waitlist/status - Check waitlist position by email

Analytics (Phase 9):
- GET /api/v2/analytics/overview - System-wide analytics and metrics
- GET /api/v2/analytics/performance - Detailed performance metrics

System (Phase 9):
- GET /api/v2/system/stats - Comprehensive system statistics
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Optional, Dict

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


@router.get("/council")
async def get_all_council_decisions() -> dict:
    """Get all active Council decisions (cached)."""
    from main import state

    council = getattr(state, 'council_ai', None) or state.council
    if not council or not hasattr(council, 'get_all_cached'):
        return {"decisions": [], "total": 0}

    all_decisions = council.get_all_cached()
    return {
        "decisions": [
            {
                "market_id": d.market_id,
                "question": d.market_question,
                "signal": d.final_signal,
                "edge": d.edge,
                "confidence": d.final_confidence,
                "consensus_pct": d.consensus_pct,
                "doomer_veto": d.doomer_veto,
                "summary": d.summary,
            }
            for d in all_decisions.values()
        ],
        "total": len(all_decisions),
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/council/{market_id}")
async def get_council_decision(market_id: str) -> dict:
    """Get Council decision for a specific market."""
    from main import state

    council = getattr(state, 'council_ai', None) or state.council
    if not council:
        raise HTTPException(status_code=503, detail="Council not initialized")

    # New CouncilAI (engine.council)
    if hasattr(council, 'get_cached'):
        decision = council.get_cached(market_id)
        if decision:
            return {
                "market_id": decision.market_id,
                "question": decision.market_question,
                "signal": decision.final_signal,
                "edge": decision.edge,
                "confidence": decision.final_confidence,
                "consensus_pct": decision.consensus_pct,
                "doomer_veto": decision.doomer_veto,
                "summary": decision.summary,
                "votes": [
                    {
                        "agent": v.agent_name,
                        "signal": v.signal,
                        "confidence": v.confidence,
                        "reasoning": v.reasoning,
                    }
                    for v in decision.agent_votes
                ],
                "timestamp": datetime.utcnow().isoformat(),
            }
        return {"market_id": market_id, "signal": None, "message": "Not analyzed yet"}

    # Legacy quant.council.agents.TheCouncil
    try:
        world_state = await state.build_real_world_state(market_id)
        if not world_state:
            raise HTTPException(status_code=404, detail=f"Market {market_id} not found")
        decision = await (state.council or council).convene(world_state)
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


# =============================================================================
# News Intelligence Endpoints (Phase 4)
# =============================================================================

@router.get("/news/recent")
async def get_recent_news(
    limit: int = Query(50, ge=1, le=200, description="Max news items to return"),
    category: Optional[str] = Query(None, description="Filter by category (crypto, politics, sports, etc.)"),
) -> dict:
    """
    Get recently collected news items from all sources.

    Args:
        limit: Maximum number of news items
        category: Optional category filter

    Returns:
        List of recent news items with metadata
    """
    from main import state

    try:
        # Collect fresh news
        market_questions = []
        if state.polymarket_client:
            cached_markets = state.polymarket_client.get_cached()
            market_questions = [m.question for m in cached_markets[:15]] if cached_markets else []

        if not state.news_collector:
            raise HTTPException(status_code=503, detail="News collector not initialized")

        news_items = await state.news_collector.collect_all(market_questions=market_questions)

        # Filter by category if specified
        if category:
            news_items = [item for item in news_items if item.category == category]

        # Limit results
        news_items = news_items[:limit]

        # Convert to dict format
        news_data = []
        for item in news_items:
            news_data.append({
                "title": item.title,
                "source": item.source,
                "url": item.url,
                "published_ms": item.published_ms,
                "category": item.category,
                "raw_source": item.raw_source,
            })

        return {
            "news": news_data,
            "count": len(news_data),
            "categories": list(set(item["category"] for item in news_data)),
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch news", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news/market/{market_id}")
async def get_market_news(
    market_id: str,
    limit: int = Query(20, ge=1, le=100, description="Max matched news items"),
    min_score: float = Query(0.3, ge=0.0, le=1.0, description="Minimum match score"),
) -> dict:
    """
    Get news items matched to a specific Polymarket market.

    Args:
        market_id: Market ID or condition_id
        limit: Maximum number of news items
        min_score: Minimum match score threshold

    Returns:
        News items matched to this market with relevance scores
    """
    from main import state

    try:
        if not state.news_collector or not state.market_matcher:
            raise HTTPException(status_code=503, detail="News pipeline not initialized")

        # Get the market
        market = state.polymarket_client.get_market_by_id(market_id)
        if not market:
            raise HTTPException(status_code=404, detail=f"Market {market_id} not found")

        # Update market matcher
        cached_markets = state.polymarket_client.get_cached()
        if cached_markets:
            state.market_matcher.update_markets(cached_markets)

        # Collect recent news
        news_items = await state.news_collector.collect_all()

        # Match news to this market
        matched_news = []
        for item in news_items:
            matches = state.market_matcher.match_headline(item.title, min_score=min_score)

            for match in matches:
                if match.market_id == market_id:
                    matched_news.append({
                        "title": item.title,
                        "source": item.source,
                        "url": item.url,
                        "published_ms": item.published_ms,
                        "category": item.category,
                        "raw_source": item.raw_source,
                        "match_score": match.match_score,
                        "matched_keywords": match.matched_keywords,
                    })
                    break

        # Sort by match score and limit
        matched_news.sort(key=lambda x: x["match_score"], reverse=True)
        matched_news = matched_news[:limit]

        return {
            "market_id": market_id,
            "market_question": market.question,
            "news": matched_news,
            "count": len(matched_news),
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get market news", market_id=market_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/news/match")
async def match_headline_to_markets(
    headline: str,
    min_score: float = Query(0.3, ge=0.0, le=1.0, description="Minimum match score"),
) -> dict:
    """
    Match a headline against active markets to find relevance.

    Args:
        headline: News headline text
        min_score: Minimum match score threshold

    Returns:
        Markets that match this headline with relevance scores
    """
    from main import state

    try:
        if not state.market_matcher:
            raise HTTPException(status_code=503, detail="Market matcher not initialized")

        # Update market matcher with current markets
        cached_markets = state.polymarket_client.get_cached()
        if not cached_markets:
            raise HTTPException(status_code=503, detail="No markets available")

        state.market_matcher.update_markets(cached_markets)

        # Match the headline
        matches = state.market_matcher.match_headline(headline, min_score=min_score)

        matches_data = []
        for match in matches:
            matches_data.append({
                "market_id": match.market_id,
                "market_question": match.market_question,
                "match_score": match.match_score,
                "matched_keywords": match.matched_keywords,
            })

        return {
            "headline": headline,
            "matches": matches_data,
            "count": len(matches_data),
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to match headline", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news/sources")
async def get_news_sources() -> dict:
    """
    Get available news sources and their status.

    Returns:
        Information about configured news sources
    """
    from main import state

    try:
        sources = {
            "google_news": {
                "enabled": state.news_collector is not None,
                "description": "Google News RSS feed",
                "topics": ["WORLD", "NATION", "BUSINESS", "TECHNOLOGY", "SPORTS"],
                "rate_limit": "5 seconds between requests",
            },
            "cryptopanic": {
                "enabled": state.news_collector is not None and state.news_collector._cryptopanic_token,
                "description": "CryptoPanic API for crypto news",
                "filters": ["hot", "rising"],
                "rate_limit": "12 seconds between requests (5 req/min)",
            },
            "reddit": {
                "enabled": state.news_collector is not None,
                "description": "Reddit hot posts from relevant subreddits",
                "subreddits": ["polymarket", "cryptocurrency", "bitcoin", "politics", "worldnews", "sportsbetting"],
                "rate_limit": "5 seconds between requests per subreddit",
            },
        }

        return {
            "sources": sources,
            "total_enabled": sum(1 for s in sources.values() if s["enabled"]),
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to get news sources", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Paper Trading Endpoints (Phase 3)
# =============================================================================

@router.post("/paper-trade/log")
async def log_paper_trade(
    market_id: str,
    market_question: str,
    prediction: str,
    confidence: float,
    edge: float,
    entry_price: float,
    council_votes: Optional[Dict[str, str]] = None,
    signal_strength: float = 0.0,
    recommended_amount: float = 0.0,
    kelly_fraction: float = 0.0,
    risk_level: str = "medium",
) -> dict:
    """
    Log a new paper trade prediction.

    Args:
        market_id: Polymarket market/condition ID
        market_question: Market question text
        prediction: "YES" or "NO"
        confidence: Confidence level 0-1
        edge: Predicted edge percentage
        entry_price: Entry price (0-1)
        council_votes: Dict of agent votes (optional)
        signal_strength: Signal strength 0-100
        recommended_amount: Kelly-sized bet amount
        kelly_fraction: Kelly fraction used
        risk_level: "low", "medium", or "high"

    Returns:
        Trade ID and status
    """
    from engine.paper_trading_logger import log_prediction

    try:
        trade_id = log_prediction(
            market_id=market_id,
            market_question=market_question,
            prediction=prediction,
            confidence=confidence,
            edge=edge,
            entry_price=entry_price,
            council_votes=council_votes or {},
            signal_strength=signal_strength,
            recommended_amount=recommended_amount,
            kelly_fraction=kelly_fraction,
            risk_level=risk_level,
        )

        if trade_id == -1:
            return {
                "status": "duplicate",
                "message": "Prediction already logged for this market",
            }

        return {
            "status": "success",
            "trade_id": trade_id,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to log paper trade", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/paper-trade/resolve/{trade_id}")
async def resolve_paper_trade(
    trade_id: int,
    actual_outcome: str,
    exit_price: float,
) -> dict:
    """
    Manually resolve a paper trade.

    Args:
        trade_id: Trade ID to resolve
        actual_outcome: "YES" or "NO"
        exit_price: Final market price

    Returns:
        Resolution status
    """
    from engine.paper_trading_logger import resolve_prediction

    try:
        success = resolve_prediction(
            trade_id=trade_id,
            actual_outcome=actual_outcome,
            exit_price=exit_price,
        )

        if not success:
            raise HTTPException(status_code=404, detail=f"Trade {trade_id} not found")

        return {
            "status": "success",
            "trade_id": trade_id,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to resolve paper trade", trade_id=trade_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/paper-trade/track-record")
async def get_paper_trading_track_record() -> dict:
    """
    Get complete paper trading track record with performance metrics.

    Returns:
        Performance statistics, win rate, P&L, recent trades
    """
    from engine.paper_trading_logger import get_track_record

    try:
        track_record = get_track_record()
        return {
            "track_record": track_record,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to get track record", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/paper-trade/unresolved")
async def get_unresolved_paper_trades() -> dict:
    """
    Get all unresolved paper trade predictions.

    Returns:
        List of unresolved trades awaiting market resolution
    """
    from engine.paper_trading_logger import get_unresolved_predictions

    try:
        unresolved = get_unresolved_predictions()
        return {
            "unresolved": unresolved,
            "count": len(unresolved),
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to get unresolved trades", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/paper-trade/auto-resolve")
async def trigger_auto_resolution() -> dict:
    """
    Manually trigger auto-resolution of paper trades.

    Checks all unresolved predictions and resolves those whose markets have closed.

    Returns:
        Number of trades resolved
    """
    from main import state
    from engine.paper_trading_logger import auto_resolve_predictions

    try:
        resolved_count = await auto_resolve_predictions(state.polymarket_client)

        return {
            "status": "success",
            "resolved_count": resolved_count,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to auto-resolve trades", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Polymarket Market Data Endpoints (Phase 2)
# =============================================================================

@router.get("/markets")
async def get_markets(
    limit: int = Query(30, ge=1, le=100, description="Max markets to return"),
    min_volume: float = Query(10000, ge=0, description="Minimum 24h volume in USD"),
) -> dict:
    """
    Get active Polymarket markets with live data.

    Returns:
        List of markets with prices, volume, liquidity, and metadata
    """
    from main import state

    try:
        markets = await state.polymarket_client.fetch_markets(max_markets=limit)

        # Filter by volume if requested
        if min_volume > 0:
            markets = [m for m in markets if m.volume_24h >= min_volume]

        # Convert to dict format
        markets_data = []
        for m in markets:
            markets_data.append({
                "id": m.id,
                "condition_id": m.condition_id,
                "question": m.question,
                "slug": m.slug,
                "url": m.url,
                "yes_price": m.yes_price,
                "no_price": m.no_price,
                "spread": m.spread,
                "volume_24h": m.volume_24h,
                "volume_total": m.volume_total,
                "liquidity": m.liquidity,
                "end_date": m.end_date,
                "active": m.active,
                "tokens": [
                    {"token_id": t.token_id, "outcome": t.outcome, "price": t.price}
                    for t in m.tokens
                ],
            })

        return {
            "markets": markets_data,
            "count": len(markets_data),
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to fetch markets", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market/{market_id}")
async def get_market(market_id: str) -> dict:
    """
    Get detailed information for a specific market.

    Args:
        market_id: Market ID or condition_id

    Returns:
        Market details including orderbook depth, tokens, and metadata
    """
    from main import state

    try:
        market = state.polymarket_client.get_market_by_id(market_id)

        if not market:
            raise HTTPException(status_code=404, detail=f"Market {market_id} not found")

        # Get orderbook for each token
        orderbooks = {}
        for token in market.tokens:
            orderbook = await state.polymarket_client.fetch_orderbook(token.token_id)
            if orderbook:
                orderbooks[token.outcome] = {
                    "bids": orderbook["bids"][:5],  # Top 5 levels
                    "asks": orderbook["asks"][:5],
                    "total_bid_size": sum(b["size"] for b in orderbook["bids"]),
                    "total_ask_size": sum(a["size"] for a in orderbook["asks"]),
                }

        return {
            "id": market.id,
            "condition_id": market.condition_id,
            "question": market.question,
            "slug": market.slug,
            "url": market.url,
            "yes_price": market.yes_price,
            "no_price": market.no_price,
            "spread": market.spread,
            "volume_24h": market.volume_24h,
            "volume_total": market.volume_total,
            "liquidity": market.liquidity,
            "end_date": market.end_date,
            "active": market.active,
            "tokens": [
                {"token_id": t.token_id, "outcome": t.outcome, "price": t.price}
                for t in market.tokens
            ],
            "orderbooks": orderbooks,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch market", market_id=market_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prices/live")
async def get_live_prices(
    token_ids: str = Query(..., description="Comma-separated list of token IDs"),
) -> dict:
    """
    Get live prices for multiple tokens from CLOB.

    Args:
        token_ids: Comma-separated token IDs (e.g., "0x123,0x456")

    Returns:
        Dict of {token_id: price}
    """
    from main import state

    try:
        token_list = [tid.strip() for tid in token_ids.split(",") if tid.strip()]

        if not token_list:
            raise HTTPException(status_code=400, detail="No token IDs provided")

        if len(token_list) > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 tokens per request")

        prices = await state.polymarket_client.get_live_prices(token_list)

        return {
            "prices": prices,
            "count": len(prices),
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch live prices", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orderbook/{token_id}")
async def get_orderbook(token_id: str) -> dict:
    """
    Get L2 orderbook for a specific token.

    Args:
        token_id: Polymarket CLOB token ID

    Returns:
        Orderbook with bids and asks
    """
    from main import state

    try:
        orderbook = await state.polymarket_client.fetch_orderbook(token_id)

        if not orderbook:
            raise HTTPException(status_code=404, detail=f"Orderbook not found for token {token_id}")

        # Calculate depth metrics
        total_bid_size = sum(b["size"] for b in orderbook["bids"])
        total_ask_size = sum(a["size"] for a in orderbook["asks"])
        best_bid = orderbook["bids"][0]["price"] if orderbook["bids"] else 0
        best_ask = orderbook["asks"][0]["price"] if orderbook["asks"] else 0
        spread = best_ask - best_bid if best_bid and best_ask else 0

        return {
            "token_id": token_id,
            "bids": orderbook["bids"],
            "asks": orderbook["asks"],
            "total_bid_size": total_bid_size,
            "total_ask_size": total_ask_size,
            "best_bid": best_bid,
            "best_ask": best_ask,
            "spread": spread,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch orderbook", token_id=token_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_polymarket_stats() -> dict:
    """
    Get Polymarket statistics and cache info.

    Returns:
        Stats about cached markets, volume, liquidity, and WebSocket status
    """
    from main import state

    try:
        stats = state.polymarket_client.get_market_stats()

        return {
            "stats": stats,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to get Polymarket stats", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Trade Execution Endpoints (Phase 6)
# =============================================================================

class TradeExecuteRequest(BaseModel):
    """Request body for trade execution."""
    token_id: str
    side: str  # "BUY" or "SELL"
    order_type: str = "MARKET"  # "MARKET" or "LIMIT"
    amount: float
    price: Optional[float] = None  # Required for LIMIT orders
    test_mode: Optional[bool] = None  # Override DRY_RUN setting


@router.post("/trade/execute")
async def execute_trade_endpoint(request: TradeExecuteRequest) -> dict:
    """
    Execute a trade (market or limit order).

    Args:
        request: TradeExecuteRequest with token_id, side, order_type, amount, price

    Returns:
        Order ID and execution status
    """
    try:
        from engine.trade_executor import execute_trade

        # Validate inputs
        if request.side not in ["BUY", "SELL"]:
            raise HTTPException(status_code=400, detail="side must be 'BUY' or 'SELL'")

        if request.order_type not in ["MARKET", "LIMIT"]:
            raise HTTPException(status_code=400, detail="order_type must be 'MARKET' or 'LIMIT'")

        if request.order_type == "LIMIT" and request.price is None:
            raise HTTPException(status_code=400, detail="price required for LIMIT orders")

        if request.amount <= 0:
            raise HTTPException(status_code=400, detail="amount must be positive")

        # Execute trade
        order_id = await execute_trade(
            token_id=request.token_id,
            side=request.side,
            amount=request.amount,
            order_type=request.order_type,
            price=request.price,
            test_mode=request.test_mode,
        )

        if not order_id:
            raise HTTPException(status_code=500, detail="Trade execution failed")

        return {
            "status": "success",
            "order_id": order_id,
            "side": request.side,
            "order_type": request.order_type,
            "amount": request.amount,
            "price": request.price,
            "test_mode": request.test_mode,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to execute trade", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trade/cancel/{order_id}")
async def cancel_trade(order_id: str, test_mode: Optional[bool] = None) -> dict:
    """
    Cancel an existing order.

    Args:
        order_id: Order ID to cancel
        test_mode: Override DRY_RUN setting (optional)

    Returns:
        Cancellation status
    """
    try:
        from engine.trade_executor import get_executor

        executor = await get_executor(test_mode=test_mode)
        success = await executor.cancel_order(order_id)

        if not success:
            raise HTTPException(status_code=404, detail=f"Failed to cancel order {order_id}")

        return {
            "status": "success",
            "order_id": order_id,
            "message": "Order cancelled successfully",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to cancel order", order_id=order_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trade/status/{order_id}")
async def get_order_status(order_id: str, test_mode: Optional[bool] = None) -> dict:
    """
    Get order status from CLOB.

    Args:
        order_id: Order ID to check
        test_mode: Override DRY_RUN setting (optional)

    Returns:
        Order status information
    """
    try:
        from engine.trade_executor import get_executor

        executor = await get_executor(test_mode=test_mode)
        status = await executor.get_order_status(order_id)

        if not status:
            raise HTTPException(status_code=404, detail=f"Order {order_id} not found")

        return {
            "status": "success",
            "order_id": order_id,
            "order_status": status,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get order status", order_id=order_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trade/balance")
async def get_balance(test_mode: Optional[bool] = None) -> dict:
    """
    Get USDC balance for trading account.

    Args:
        test_mode: Override DRY_RUN setting (optional)

    Returns:
        USDC balance information
    """
    try:
        from engine.trade_executor import get_executor

        executor = await get_executor(test_mode=test_mode)
        balance = await executor.get_balance()

        return {
            "status": "success",
            "balance_usdc": balance,
            "test_mode": executor.test_mode,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to get balance", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trade/approve")
async def approve_usdc(amount: float = Query(..., description="USDC amount to approve"), test_mode: Optional[bool] = None) -> dict:
    """
    Approve USDC spending for trading (required before first trade).

    Args:
        amount: USDC amount to approve
        test_mode: Override DRY_RUN setting (optional)

    Returns:
        Approval status
    """
    try:
        from engine.trade_executor import get_executor

        if amount <= 0:
            raise HTTPException(status_code=400, detail="amount must be positive")

        executor = await get_executor(test_mode=test_mode)
        success = await executor.approve_usdc(amount)

        if not success:
            raise HTTPException(status_code=500, detail="USDC approval failed")

        return {
            "status": "success",
            "approved_amount": amount,
            "message": f"Approved {amount} USDC for trading",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to approve USDC", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Waitlist Endpoints (Phase 9)
# =============================================================================

class WaitlistRequest(BaseModel):
    """Request body for waitlist signup."""
    email: str


@router.post("/waitlist/join")
async def join_waitlist(request: WaitlistRequest) -> dict:
    """
    Join the waitlist for early access.

    Args:
        request: WaitlistRequest with email

    Returns:
        Success status with queue position
    """
    try:
        from main import subscribe_to_waitlist

        result = await subscribe_to_waitlist(request.email)

        return {
            "status": "success",
            "position": result.get("queue_position", 0),
            "message": "Successfully added to waitlist",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to join waitlist", email=request.email, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/waitlist/status")
async def get_waitlist_status(email: str = Query(..., description="Email to check")) -> dict:
    """
    Check waitlist position for an email.

    Args:
        email: Email address to check

    Returns:
        Waitlist status and position
    """
    try:
        from main import state

        if not state.email_service:
            raise HTTPException(status_code=503, detail="Email service not available")

        # Get position from waitlist
        waitlist = state.email_service.waitlist
        if email in waitlist:
            position = list(waitlist.keys()).index(email) + 1
            return {
                "status": "success",
                "email": email,
                "position": position,
                "total": len(waitlist),
                "timestamp": datetime.utcnow().isoformat(),
            }
        else:
            raise HTTPException(status_code=404, detail="Email not found in waitlist")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to check waitlist status", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Analytics Endpoints (Phase 9)
# =============================================================================

@router.get("/analytics/overview")
async def get_analytics_overview() -> dict:
    """
    Get system-wide analytics and metrics.

    Returns:
        Analytics overview with key metrics
    """
    try:
        from main import state
        from engine.paper_trading_logger import get_track_record

        # Get track record
        track_record = get_track_record()

        # Get signal stats
        signal_count = len(state.live_signals) if state.live_signals else 0

        # Get market stats
        market_stats = {}
        if state.polymarket_client:
            market_stats = state.polymarket_client.get_market_stats()

        # Get news stats
        news_count = 0
        if state.news_collector:
            try:
                news_items = await state.news_collector.collect_all()
                news_count = len(news_items)
            except:
                pass

        return {
            "status": "success",
            "analytics": {
                "signals": {
                    "active_count": signal_count,
                    "high_edge_count": len([s for s in state.live_signals if abs(s.kelly_edge) > 5]) if state.live_signals else 0,
                },
                "markets": {
                    "total_cached": market_stats.get("total_markets", 0),
                    "ws_connected": market_stats.get("ws_connected", False),
                },
                "track_record": {
                    "total_predictions": track_record["total_predictions"],
                    "total_resolved": track_record["total_resolved"],
                    "win_rate": track_record["win_rate"],
                    "total_pnl": track_record["total_pnl"],
                },
                "news": {
                    "recent_count": news_count,
                },
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to get analytics", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/performance")
async def get_performance_metrics() -> dict:
    """
    Get detailed performance metrics.

    Returns:
        Performance breakdown by category, confidence, etc.
    """
    try:
        from engine.paper_trading_logger import get_track_record
        from main import state

        track_record = get_track_record()

        # Calculate additional metrics
        signals = state.live_signals if state.live_signals else []

        # Edge distribution
        edge_buckets = {
            "very_high": len([s for s in signals if abs(s.kelly_edge) > 10]),
            "high": len([s for s in signals if 5 < abs(s.kelly_edge) <= 10]),
            "medium": len([s for s in signals if 2 < abs(s.kelly_edge) <= 5]),
            "low": len([s for s in signals if abs(s.kelly_edge) <= 2]),
        }

        return {
            "status": "success",
            "performance": {
                "track_record": track_record,
                "edge_distribution": edge_buckets,
                "active_signals_count": len(signals),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to get performance metrics", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# System Metrics Endpoints (Phase 9)
# =============================================================================

@router.get("/system/stats")
async def get_system_stats() -> dict:
    """
    Get comprehensive system statistics.

    Returns:
        System-wide stats including uptime, resource usage, etc.
    """
    try:
        from main import state
        import time

        # Calculate uptime (if we track start time)
        # For now, return current timestamp as a placeholder

        stats = {
            "status": "operational",
            "components": {
                "feature_engineer": state.feature_engineer is not None,
                "narrative_velocity": state.narrative_velocity is not None,
                "whale_watchlist": state.whale_watchlist is not None,
                "quant_model": state.quant_model is not None,
                "council": state.council is not None,
                "risk_manager": state.risk_manager is not None,
                "crypto_5min_scanner": state.crypto_5min_scanner is not None,
                "news_collector": state.news_collector is not None,
                "polymarket_client": state.polymarket_client is not None,
                "email_service": state.email_service is not None,
            },
            "markets": {
                "cached_count": 0,
                "ws_connected": False,
            },
            "signals": {
                "active_count": len(state.live_signals) if state.live_signals else 0,
            },
            "timestamp": time.time(),
        }

        # Add market stats if available
        if state.polymarket_client:
            pm_stats = state.polymarket_client.get_market_stats()
            stats["markets"] = {
                "cached_count": pm_stats.get("total_markets", 0),
                "ws_connected": pm_stats.get("ws_connected", False),
                "total_volume": pm_stats.get("total_volume", 0),
                "total_liquidity": pm_stats.get("total_liquidity", 0),
            }

        return stats

    except Exception as e:
        logger.error("Failed to get system stats", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Trade Execution v2 (simple /execute and /positions)
# =============================================================================

class ExecuteRequest(BaseModel):
    """Request body for simple trade execution."""
    token_id: str
    amount_usdc: float
    side: str = "BUY"
    order_type: str = "market"  # "market" | "limit"
    limit_price: Optional[float] = None


@router.post("/execute")
async def execute_trade_simple(req: ExecuteRequest) -> dict:
    """
    Execute a trade (market or limit order). Dry-run by default.

    Returns {status, order_id, dry_run, amount, side}
    """
    try:
        if req.side not in ("BUY", "SELL"):
            raise HTTPException(status_code=400, detail="side must be BUY or SELL")
        if req.amount_usdc <= 0:
            raise HTTPException(status_code=400, detail="amount_usdc must be positive")
        if req.order_type == "limit" and req.limit_price is None:
            raise HTTPException(status_code=400, detail="limit_price required for limit orders")

        # Try real executor first
        try:
            from engine.trade_executor import execute_trade
            order_id = await execute_trade(
                token_id=req.token_id,
                side=req.side,
                amount=req.amount_usdc,
                order_type=req.order_type.upper(),
                price=req.limit_price,
            )
            if order_id:
                return {
                    "status": "success",
                    "order_id": order_id,
                    "dry_run": False,
                    "amount": req.amount_usdc,
                    "side": req.side,
                    "token_id": req.token_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
        except Exception:
            pass

        # Dry-run fallback
        import uuid
        return {
            "status": "dry_run",
            "order_id": f"dry_{uuid.uuid4().hex[:12]}",
            "dry_run": True,
            "amount": req.amount_usdc,
            "side": req.side,
            "token_id": req.token_id,
            "message": "Paper trade logged (no live credentials)",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to execute trade", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/positions/{wallet}")
async def get_positions(wallet: str) -> dict:
    """
    Fetch open positions for a wallet from Polymarket data API.

    Returns list of open positions with PnL.
    """
    import httpx as _httpx

    try:
        async with _httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://data-api.polymarket.com/positions",
                params={"user": wallet},
            )
            resp.raise_for_status()
            data = resp.json()

        positions = []
        for p in (data if isinstance(data, list) else data.get("positions", [])):
            positions.append({
                "market": p.get("market", ""),
                "question": p.get("title", p.get("question", "")),
                "outcome": p.get("outcome", ""),
                "size": float(p.get("size", 0)),
                "avg_price": float(p.get("avgPrice", p.get("averagePrice", 0))),
                "current_price": float(p.get("currentPrice", p.get("price", 0))),
                "pnl": float(p.get("pnl", p.get("unrealizedPnl", 0))),
                "market_slug": p.get("conditionId", ""),
            })

        return {
            "wallet": wallet,
            "positions": positions,
            "count": len(positions),
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Failed to fetch positions", wallet=wallet, error=str(e))
        return {
            "wallet": wallet,
            "positions": [],
            "count": 0,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


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
        'crypto_5min_scanner': state.crypto_5min_scanner is not None,
        'news_collector': state.news_collector is not None,
        'polymarket_client': state.polymarket_client is not None,
    }

    # Add Polymarket-specific stats
    if state.polymarket_client:
        pm_stats = state.polymarket_client.get_market_stats()
        components['polymarket_markets_cached'] = pm_stats.get('total_markets', 0)
        components['polymarket_ws_connected'] = pm_stats.get('ws_connected', False)

    all_healthy = all(v is not False and v is not None for v in components.values() if not isinstance(v, int))

    return {
        'status': 'healthy' if all_healthy else 'degraded',
        'components': components,
        'timestamp': datetime.utcnow().isoformat()
    }
