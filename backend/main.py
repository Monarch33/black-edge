"""
Black Edge: Quantitative Arbitrage Engine
==========================================
FastAPI application entry point.

This is the main entry point for the Black Edge API server.
It combines:
- REST endpoints for arbitrage queries and execution
- WebSocket streaming for real-time opportunities
- Background tasks for blockchain monitoring and arbitrage detection
"""

import asyncio
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Any

from fastapi import FastAPI, WebSocket
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog
import uvicorn

from config import get_settings
from api.websocket import websocket_handler, manager as ws_manager, heartbeat_task
from engine.polymarket import PolymarketClient
from engine.analytics import QuantEngine, QuantSignal
from services.email_service import EmailService

# Initialize logger and settings FIRST
logger = structlog.get_logger()
settings = get_settings()

# Optional imports (require numpy/pandas/scipy)
try:
    from engine.blockchain import BlockchainPipeline, OrderFilledEvent, PositionsConvertedEvent
    from engine import ArbitrageDetector, MarketState
    from engine.risk_calculator import RiskCalculator
    from routers.arbitrage import router as arbitrage_router
    ADVANCED_FEATURES_AVAILABLE = True
except ImportError as e:
    logger.warning("⚠️ Advanced features disabled (numpy/pandas/scipy not available)", error=str(e))
    BlockchainPipeline = None
    ArbitrageDetector = None
    RiskCalculator = None
    arbitrage_router = None
    ADVANCED_FEATURES_AVAILABLE = False


# =============================================================================
# Application State
# =============================================================================

class AppState:
    """Global application state."""

    def __init__(self):
        self.blockchain_pipeline: BlockchainPipeline | None = None
        self.arbitrage_detector: ArbitrageDetector | None = None
        self.risk_calculator: RiskCalculator | None = None
        self.polymarket_client: PolymarketClient = PolymarketClient()
        self.quant_engine: QuantEngine = QuantEngine()
        self.email_service: EmailService = EmailService()
        self.live_signals: list[QuantSignal] = []
        self._background_tasks: list[asyncio.Task] = []

        # V2 Quant modules (initialized in startup)
        self.feature_engineer = None
        self.narrative_velocity = None
        self.whale_watchlist = None
        self.quant_model = None
        self.council = None
        self.risk_manager = None
        self.active_markets: list[str] = []  # Markets to track

        # News pipeline modules (initialized in startup)
        self.news_collector = None
        self.market_matcher = None

        # Crypto 5-min scanner (initialized in startup)
        self.crypto_5min_scanner = None

    async def startup(self) -> None:
        """Initialize application state on startup."""
        logger.info("Initializing application state...")

        # Initialize advanced components (if available)
        if ADVANCED_FEATURES_AVAILABLE:
            self.blockchain_pipeline = BlockchainPipeline()
            self.arbitrage_detector = ArbitrageDetector(
                min_profit_threshold=settings.min_profit_threshold,
                max_position_probability=settings.max_position_probability,
            )
            self.risk_calculator = RiskCalculator(
                analysis_window=settings.risk_analysis_window,
                min_profit_threshold=settings.min_profit_threshold,
            )

            # Register event callback
            self.blockchain_pipeline.register_callback(self._on_blockchain_event)
            logger.info("✅ Advanced features enabled")
        else:
            logger.info("ℹ️ Running in minimal mode (Polymarket data only)")

        # Initialize V2 Quant modules
        try:
            from quant.feature_engineer import FeatureEngineer
            from quant.narrative_velocity import NarrativeVelocityLite
            from quant.whale_tracker import WhaleWatchlist
            from quant.quant_model import QuantModel
            from quant.council.agents import TheCouncil
            from quant.risk.manager import RiskManager

            self.feature_engineer = FeatureEngineer()
            self.narrative_velocity = NarrativeVelocityLite()
            self.whale_watchlist = WhaleWatchlist()
            self.quant_model = QuantModel()
            self.council = TheCouncil()
            self.risk_manager = RiskManager()

            logger.info("✅ V2 Quant modules initialized")
        except Exception as e:
            logger.warning("⚠️ V2 Quant modules not available", error=str(e))
            # Fallback: use engine.council.CouncilAI (always available)
            if self.council is None:
                try:
                    from engine.council import CouncilAI
                    self.council = CouncilAI()
                    logger.info("✅ CouncilAI (engine) initialized")
                except Exception as ce:
                    logger.warning("⚠️ CouncilAI not available", error=str(ce))

        # Initialize news pipeline
        try:
            import os
            from engine.news_collector import NewsCollector
            from engine.market_matcher import MarketMatcher

            cryptopanic_token = os.environ.get("CRYPTOPANIC_TOKEN", "")
            self.news_collector = NewsCollector(cryptopanic_token=cryptopanic_token)
            self.market_matcher = MarketMatcher()
            logger.info("✅ News pipeline initialized")
        except Exception as e:
            logger.warning("⚠️ News pipeline not available", error=str(e))

        # Initialize 5-min crypto scanner
        try:
            from engine.crypto_5min_scanner import Crypto5MinScanner
            self.crypto_5min_scanner = Crypto5MinScanner()
            logger.info("✅ 5-min crypto scanner initialized")
        except Exception as e:
            logger.warning("⚠️ 5-min crypto scanner not available", error=str(e))

        # Start Polymarket WebSocket for real-time price feeds (Phase 2)
        try:
            logger.info("Starting Polymarket WebSocket...")
            # Start WebSocket in background (non-blocking)
            asyncio.create_task(self._start_polymarket_websocket())
        except Exception as e:
            logger.warning("Failed to start Polymarket WebSocket", error=str(e))

        # Start background tasks
        self._background_tasks.append(
            asyncio.create_task(self._blockchain_monitor_task())
        )
        self._background_tasks.append(
            asyncio.create_task(heartbeat_task(30.0))
        )
        self._background_tasks.append(
            asyncio.create_task(self._polymarket_poll_task())
        )
        self._background_tasks.append(
            asyncio.create_task(self._v2_feature_update_task())
        )
        self._background_tasks.append(
            asyncio.create_task(self._news_ingestion_task())
        )
        self._background_tasks.append(
            asyncio.create_task(self._crypto_5min_scan_task())
        )
        self._background_tasks.append(
            asyncio.create_task(self._paper_trading_auto_resolve_task())
        )
        self._background_tasks.append(
            asyncio.create_task(self._orderbook_update_task())
        )
        self._background_tasks.append(
            asyncio.create_task(self._council_analysis_task())
        )

        logger.info("Application state initialized")

    async def shutdown(self) -> None:
        """Cleanup on shutdown."""
        logger.info("Shutting down application...")

        # Cancel background tasks
        for task in self._background_tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Cleanup blockchain pipeline
        if self.blockchain_pipeline:
            await self.blockchain_pipeline.stop()

        # Cleanup Polymarket HTTP client
        await self.polymarket_client.close()

        # Cleanup news collector
        if self.news_collector:
            await self.news_collector.close()

        # Cleanup crypto scanner
        if self.crypto_5min_scanner:
            await self.crypto_5min_scanner.close()

        logger.info("Application shutdown complete")

    async def _on_blockchain_event(
        self,
        event: OrderFilledEvent | PositionsConvertedEvent,
    ) -> None:
        """Handle blockchain events for arbitrage detection."""
        if isinstance(event, OrderFilledEvent):
            # Record trade for risk analysis
            if self.risk_calculator:
                self.risk_calculator.record_trade(event)

            # Log significant trades
            if event.maker_amount > 1000 * 1e6:  # > $1000
                logger.info(
                    "Large trade detected",
                    maker=event.maker[:10],
                    amount=event.maker_amount / 1e6,
                    block=event.block_number,
                )

    async def _start_polymarket_websocket(self) -> None:
        """
        Start Polymarket WebSocket for real-time price feeds (Phase 2).
        Enhanced in Phase 5 to ingest price ticks into FeatureEngineer.
        Waits for initial markets to be fetched, then subscribes to top markets.
        """
        # Wait for initial market fetch
        await asyncio.sleep(5)

        try:
            markets = self.polymarket_client.get_cached()
            if not markets:
                logger.warning("No cached markets available, skipping WebSocket initialization")
                return

            # Register price callback for FeatureEngineer ingestion (Phase 5)
            if self.feature_engineer:
                self.polymarket_client.register_price_callback(self._on_price_update)
                logger.info("✅ Registered price callback for FeatureEngineer")

            # Subscribe to top 10 markets by volume
            top_markets = markets[:10]
            market_ids = [m.condition_id for m in top_markets if m.condition_id]

            if market_ids:
                logger.info(f"Starting WebSocket with {len(market_ids)} market subscriptions")
                await self.polymarket_client.start_websocket(market_ids=market_ids)
                logger.info("✅ Polymarket WebSocket started successfully")
            else:
                logger.warning("No valid market IDs found for WebSocket subscription")

        except Exception as e:
            logger.error("Failed to initialize Polymarket WebSocket", error=str(e))

    def build_world_state(self, market_id: str) -> Optional[Any]:
        """
        Build a complete WorldState for a market (Phase 5).

        Aggregates data from FeatureEngineer, NarrativeVelocity, and other sources
        into a single WorldState object for Council decision-making.

        Args:
            market_id: Market to build state for

        Returns:
            WorldState object or None if insufficient data
        """
        try:
            if not self.feature_engineer or not self.narrative_velocity:
                return None

            # Get market data
            market = self.polymarket_client.get_market_by_id(market_id)
            if not market:
                return None

            # Compute features
            features = self.feature_engineer.compute(market_id)
            if not features or not features.is_valid:
                return None

            # Get narrative signal
            narrative = self.narrative_velocity.compute_signal(market_id)

            # Build WorldState components
            from quant.council.agents import (
                WorldState, MarketMicrostructure, NarrativeState,
                OnChainState, PortfolioState
            )
            import time

            micro = MarketMicrostructure(
                order_book_imbalance=features.order_book_imbalance,
                volume_z_score=features.volume_z_score,
                momentum_1h=features.momentum_1h,
                momentum_4h=0.0,  # Not computed yet
                momentum_24h=0.0,  # Not computed yet
                spread_bps=features.spread_bps,
                liquidity_depth_usd=market.liquidity,
                price_reversion_score=0.0,  # Not computed yet
            )

            narrative_state = NarrativeState(
                sentiment_score=features.sentiment_score,
                nvi_score=narrative.get("nvi_score", 0.0) if narrative else 0.0,
                novelty_index=narrative.get("novelty", 0.0) if narrative else 0.0,
                credibility_factor=narrative.get("credibility", 0.5) if narrative else 0.5,
                sarcasm_probability=0.0,  # Not computed yet
                tweet_volume_z=0.0,  # Not computed yet
                narrative_coherence=narrative.get("coherence", 0.5) if narrative else 0.5,
            )

            on_chain = OnChainState(
                smart_money_flow=0.0,  # Placeholder
                whale_concentration=0.0,  # Placeholder
                retail_flow=0.0,  # Placeholder
                cross_platform_spread=0.0,  # Placeholder
                gas_congestion_pct=0.0,  # Placeholder
            )

            portfolio = PortfolioState(
                current_drawdown=0.0,  # Placeholder
                correlated_exposure=0.0,  # Placeholder
                leverage=0.0,  # Placeholder
                sharpe_ratio=0.0,  # Placeholder
                win_rate=0.5,  # Placeholder
            )

            world_state = WorldState(
                market_id=market_id,
                timestamp_ms=int(time.time() * 1000),
                mid_price=features.mid_price,
                micro=micro,
                narrative=narrative_state,
                on_chain=on_chain,
                portfolio=portfolio,
            )

            return world_state

        except Exception as e:
            logger.error("Failed to build WorldState", market_id=market_id, error=str(e))
            return None

    async def _on_price_update(self, token_id: str, price_data: dict) -> None:
        """
        WebSocket price update callback for real-time tick ingestion (Phase 5).

        Args:
            token_id: Token ID that was updated
            price_data: Price update data from WebSocket
        """
        try:
            # Find the market this token belongs to
            markets = self.polymarket_client.get_cached()
            market = None
            for m in markets:
                if any(t.token_id == token_id for t in m.tokens):
                    market = m
                    break

            if not market or not self.feature_engineer:
                return

            # Create a MarketTick and ingest it
            from quant.config import MarketTick
            import time

            tick = MarketTick(
                market_id=market.id,
                timestamp_ms=int(time.time() * 1000),
                mid_price=float(price_data.get("price", market.yes_price)),
                volume_1h_usd=market.volume_24h / 24.0,  # Approximate 1h volume
            )

            self.feature_engineer.ingest_tick(tick)

            logger.debug(
                "Price tick ingested",
                market_id=market.id[:12],
                price=tick.mid_price,
            )

        except Exception as e:
            logger.error("Failed to ingest price tick", token_id=token_id[:12], error=str(e))

    async def _auto_log_paper_trades(self, signals, markets) -> None:
        """
        Auto-log high-confidence signals as paper trades (Phase 3).

        Criteria for auto-logging:
        - Signal strength >= 70
        - Edge >= 3%
        - Not already logged (handled by database UNIQUE constraint)
        """
        from engine.paper_trading_logger import log_prediction

        for signal in signals:
            # Only log high-confidence signals
            if signal.signal_strength < 70 or signal.edge < 3.0:
                continue

            try:
                # Find the corresponding market for more details
                market = next((m for m in markets if m.id == signal.id or m.question == signal.question), None)

                if not market:
                    continue

                # Determine prediction based on edge and price
                # If yes_price is low and edge is positive, predict YES
                # If no_price is low and edge is positive, predict NO
                prediction = "YES" if market.yes_price < 0.5 else "NO"
                entry_price = market.yes_price if prediction == "YES" else market.no_price

                # Calculate Kelly fraction (simplified)
                bankroll = 1000.0  # Assume $1000 bankroll
                kelly_fraction = min(signal.edge / 100.0, 0.25)  # Cap at 25% Kelly
                recommended_amount = bankroll * kelly_fraction

                # Map risk level
                risk_level = "low" if signal.edge > 10 else "medium" if signal.edge > 5 else "high"

                # Log the prediction
                trade_id = log_prediction(
                    market_id=market.condition_id or market.id,
                    market_question=market.question,
                    prediction=prediction,
                    confidence=signal.signal_strength / 100.0,
                    edge=signal.edge / 100.0,
                    entry_price=entry_price,
                    council_votes={},  # Will be populated if Council integration is added
                    signal_strength=signal.signal_strength,
                    recommended_amount=recommended_amount,
                    kelly_fraction=kelly_fraction,
                    risk_level=risk_level,
                    platform="polymarket",
                )

                if trade_id > 0:
                    logger.info(
                        "📝 Auto-logged paper trade",
                        trade_id=trade_id,
                        market=market.question[:50],
                        prediction=prediction,
                        edge=f"{signal.edge:.1f}%",
                    )

            except Exception as e:
                logger.error("Failed to auto-log paper trade", error=str(e), signal=signal.market)

    async def _polymarket_poll_task(self) -> None:
        """Background task to poll Polymarket and run quant analysis."""
        POLL_INTERVAL = 30  # seconds between full refreshes (respect rate limits)

        logger.info("🚀 Polymarket polling task started", interval=POLL_INTERVAL)

        # TEST FETCH: Verify Polymarket connectivity on startup
        try:
            logger.info("🔍 TEST: Attempting to fetch Polymarket markets...")
            test_markets = await self.polymarket_client.fetch_markets(max_markets=5)
            if test_markets:
                logger.info(
                    "✅ POLYMARKET CONNECTIVITY TEST PASSED",
                    markets_fetched=len(test_markets),
                    top_market=test_markets[0].question if test_markets else None,
                    top_volume=test_markets[0].volume_24h if test_markets else 0,
                )
            else:
                logger.error("❌ POLYMARKET CONNECTIVITY TEST FAILED: No markets returned")
        except Exception as e:
            logger.error(
                "❌ POLYMARKET CONNECTIVITY TEST FAILED",
                error=str(e),
                error_type=type(e).__name__,
            )

        while True:
            try:
                markets = await self.polymarket_client.fetch_markets(max_markets=30)

                if markets:
                    signals = self.quant_engine.analyze(markets)
                    self.live_signals = signals

                    # Update active markets list for V2 pipeline
                    self.active_markets = [m.id for m in markets[:20]]

                    # Auto-log high-confidence paper trades (Phase 3)
                    await self._auto_log_paper_trades(signals, markets)

                    logger.info(
                        "📊 Polymarket signals refreshed",
                        market_count=len(markets),
                        signal_count=len(signals),
                        top_signal=signals[0].signal_strength if signals else 0,
                        top_market=signals[0].market if signals else None,
                    )

                    # Broadcast top signals via WebSocket
                    if signals and ws_manager.connection_count > 0:
                        top = signals[:5]
                        await ws_manager.broadcast({
                            "type": "signals_update",
                            "data": [s.to_api_dict() for s in top],
                        })
                else:
                    logger.warning(
                        "⚠️ NO MARKETS RETURNED FROM POLYMARKET - Using cached signals",
                        cache_size=len(self.live_signals),
                    )

            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(
                    "❌ POLYMARKET POLL ERROR",
                    error=str(e),
                    error_type=type(e).__name__,
                    cached_signals=len(self.live_signals),
                )

            await asyncio.sleep(POLL_INTERVAL)

    async def _blockchain_monitor_task(self) -> None:
        """Background task to monitor blockchain for events."""
        if not self.blockchain_pipeline:
            return

        try:
            await self.blockchain_pipeline.start()
        except Exception as e:
            logger.error("Blockchain monitor failed", error=str(e))

    async def _news_ingestion_task(self) -> None:
        """
        Background task that collects news every 2 minutes and injects
        them into FeatureEngineer and NarrativeVelocityLite.

        THIS IS THE MISSING BRIDGE between external data and the model.
        """
        if not self.news_collector or not self.feature_engineer or not self.narrative_velocity:
            logger.info("News ingestion task disabled (modules not initialized)")
            return

        NEWS_INTERVAL = 120  # seconds (2 minutes)
        logger.info("🚀 News ingestion task started", interval=NEWS_INTERVAL)

        # Wait for initial Polymarket data to be available
        await asyncio.sleep(10)

        while True:
            try:
                # Get current active market questions for targeted search
                market_questions = []
                cached_markets = self.polymarket_client.get_cached()

                if cached_markets:
                    market_questions = [m.question for m in cached_markets[:15]]

                    # Update the market matcher with current markets
                    self.market_matcher.update_markets(cached_markets)

                # Collect news from all sources
                news_items = await self.news_collector.collect_all(
                    market_questions=market_questions
                )

                if not news_items:
                    logger.debug("No new news items collected")
                    await asyncio.sleep(NEWS_INTERVAL)
                    continue

                # For each headline, find matching markets and inject
                injected_count = 0
                matched_count = 0

                for item in news_items:
                    # Match headline to markets
                    matches = self.market_matcher.match_headline(item.title)

                    if matches:
                        matched_count += 1
                        for match in matches[:3]:  # Max 3 markets per headline
                            try:
                                # Inject into FeatureEngineer (sentiment analysis)
                                self.feature_engineer.ingest_headline(
                                    headline=item.title,
                                    timestamp_ms=item.published_ms,
                                    market_id=match.market_id,
                                )

                                # Inject into NarrativeVelocityLite (keyword tracking)
                                self.narrative_velocity.ingest(
                                    text=item.title,
                                    market_id=match.market_id,
                                    timestamp_ms=item.published_ms,
                                )

                                injected_count += 1
                            except Exception as e:
                                logger.debug("Failed to inject headline", error=str(e))

                    else:
                        # No market match — inject as "global" sentiment
                        # This still feeds the NVI for trending keyword detection
                        try:
                            # Use category as a generic market_id for global tracking
                            global_market_id = f"__global_{item.category}__"
                            self.narrative_velocity.ingest(
                                text=item.title,
                                market_id=global_market_id,
                                timestamp_ms=item.published_ms,
                            )
                        except Exception:
                            pass

                logger.info(
                    "📰 News ingestion cycle complete",
                    total_headlines=len(news_items),
                    matched_to_markets=matched_count,
                    injected_signals=injected_count,
                )

            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("News ingestion error", error=str(e))

            await asyncio.sleep(NEWS_INTERVAL)

    async def _crypto_5min_scan_task(self) -> None:
        """
        Background task that scans for 5-min BTC arbitrage signals.
        Runs every 10 seconds.
        """
        if not self.crypto_5min_scanner:
            logger.info("5-min crypto scan task disabled (scanner not initialized)")
            return

        SCAN_INTERVAL = 10  # seconds
        logger.info("⚡ 5-min crypto scan task started", interval=SCAN_INTERVAL)

        # Wait a bit for startup
        await asyncio.sleep(5)

        while True:
            try:
                # Discover active markets
                markets = await self.crypto_5min_scanner.discover_active_markets()

                if markets:
                    # Scan for latency signals
                    signals = await self.crypto_5min_scanner.scan_for_signals()

                    # Broadcast via WebSocket
                    if signals and ws_manager.connection_count > 0:
                        await ws_manager.broadcast({
                            "type": "crypto_5min_signals",
                            "data": [
                                {
                                    "market": s.market_slug,
                                    "direction": s.direction,
                                    "btcMove": round(s.binance_move_pct, 3),
                                    "marketPrice": round(s.polymarket_up_price, 3),
                                    "trueProbability": round(s.estimated_true_prob, 3),
                                    "edge": round(s.edge, 3),
                                    "confidence": s.confidence,
                                    "timeRemaining": round(s.time_remaining_seconds),
                                    "recommendedSide": s.recommended_side,
                                    "tokenId": s.recommended_token_id,
                                }
                                for s in signals[:5]
                            ],
                        })

            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("5-min scan error", error=str(e))

            await asyncio.sleep(SCAN_INTERVAL)

    async def _paper_trading_auto_resolve_task(self) -> None:
        """
        Background task to auto-resolve paper trading predictions (Phase 3).
        Checks every hour for closed markets and resolves predictions.
        """
        from engine.paper_trading_logger import auto_resolve_predictions

        RESOLVE_INTERVAL = 3600  # 1 hour
        logger.info("📊 Paper trading auto-resolve task started", interval=f"{RESOLVE_INTERVAL/60:.0f}min")

        # Wait for initial market data
        await asyncio.sleep(60)

        while True:
            try:
                resolved_count = await auto_resolve_predictions(self.polymarket_client)

                if resolved_count > 0:
                    logger.info(f"✅ Auto-resolved {resolved_count} paper trades")

            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("Paper trading auto-resolve error", error=str(e))

            await asyncio.sleep(RESOLVE_INTERVAL)

    async def _orderbook_update_task(self) -> None:
        """
        Background task to update orderbooks for top markets (Phase 5).
        Fetches L2 orderbook data every 30 seconds for feature engineering.
        """
        if not self.feature_engineer:
            logger.info("Orderbook update task disabled (FeatureEngineer not initialized)")
            return

        UPDATE_INTERVAL = 30  # seconds
        logger.info("📚 Orderbook update task started", interval=f"{UPDATE_INTERVAL}s")

        # Wait for initial market data
        await asyncio.sleep(15)

        while True:
            try:
                markets = self.polymarket_client.get_cached()
                if not markets:
                    await asyncio.sleep(UPDATE_INTERVAL)
                    continue

                # Update orderbooks for top 15 markets
                from quant.config import OrderBookSnapshot, OrderBookLevel
                import time

                updated_count = 0
                for market in markets[:15]:
                    if not market.tokens:
                        continue

                    try:
                        # Fetch orderbook for first token (YES side)
                        token_id = market.tokens[0].token_id
                        book_data = await self.polymarket_client.fetch_orderbook(token_id)

                        if book_data:
                            orderbook = OrderBookSnapshot(
                                market_id=market.id,
                                timestamp_ms=int(time.time() * 1000),
                                bids=[
                                    OrderBookLevel(
                                        price=b["price"],
                                        size=b["size"]
                                    )
                                    for b in book_data.get("bids", [])[:20]
                                ],
                                asks=[
                                    OrderBookLevel(
                                        price=a["price"],
                                        size=a["size"]
                                    )
                                    for a in book_data.get("asks", [])[:20]
                                ],
                            )
                            self.feature_engineer.ingest_orderbook(orderbook)
                            updated_count += 1

                    except Exception as e:
                        logger.debug("Orderbook fetch failed", market_id=market.id[:12], error=str(e))

                if updated_count > 0:
                    logger.info(f"📚 Updated {updated_count} orderbooks")

            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("Orderbook update error", error=str(e))

            await asyncio.sleep(UPDATE_INTERVAL)

    async def _v2_feature_update_task(self) -> None:
        """Background task to compute V2 features every 10 seconds."""
        if not self.feature_engineer or not self.quant_model:
            logger.info("V2 feature update task disabled (modules not initialized)")
            return

        UPDATE_INTERVAL = 10  # seconds
        logger.info("🚀 V2 feature update task started", interval=UPDATE_INTERVAL)

        while True:
            try:
                # Update features for all active markets
                if self.active_markets:
                    from api.websocket_v2 import (
                        broadcast_signal_update,
                        broadcast_narrative_shift,
                        manager as ws_manager_v2
                    )
                    from dataclasses import asdict

                    for market_id in self.active_markets[:20]:  # Limit to 20 markets
                        try:
                            # Fetch orderbook for OBI computation
                            try:
                                # Get the token ID for this market
                                cached = self.polymarket_client.get_cached()
                                market_data = next(
                                    (m for m in cached if m.id == market_id), None
                                )
                                if market_data and market_data.tokens:
                                    token_id = market_data.tokens[0].token_id
                                    book_data = await self.polymarket_client.fetch_orderbook(token_id)

                                    if book_data:
                                        from quant.config import OrderBookSnapshot, OrderBookLevel

                                        orderbook = OrderBookSnapshot(
                                            market_id=market_id,
                                            timestamp_ms=int(time.time() * 1000),
                                            bids=[
                                                OrderBookLevel(
                                                    price=b["price"],
                                                    size=b["size"]
                                                )
                                                for b in book_data.get("bids", [])[:10]
                                            ],
                                            asks=[
                                                OrderBookLevel(
                                                    price=a["price"],
                                                    size=a["size"]
                                                )
                                                for a in book_data.get("asks", [])[:10]
                                            ],
                                        )
                                        self.feature_engineer.ingest_orderbook(orderbook)
                            except Exception as e:
                                logger.debug("Orderbook fetch failed for feature update",
                                           market_id=market_id, error=str(e))

                            # Compute features
                            features = self.feature_engineer.compute(market_id)

                            if not features or not features.is_valid:
                                continue

                            # Compute narrative
                            narrative = self.narrative_velocity.compute_signal(market_id)

                            # Check whale alignment (simplified)
                            whale_aligned = False

                            # Compute signal
                            signal_output = self.quant_model.compute_signal(
                                features=features,
                                narrative=narrative,
                                whale_is_aligned=whale_aligned
                            )

                            # Broadcast signal update via WebSocket
                            if ws_manager_v2.connection_count > 0:
                                await broadcast_signal_update(
                                    market_id=market_id,
                                    signal_data=asdict(signal_output)
                                )

                            # Check for narrative shift
                            if narrative and narrative.is_accelerating:
                                if ws_manager_v2.connection_count > 0:
                                    await broadcast_narrative_shift(
                                        market_id=market_id,
                                        narrative_data=asdict(narrative)
                                    )

                        except Exception as e:
                            logger.error(
                                "Failed to update features for market",
                                market_id=market_id,
                                error=str(e)
                            )

                    logger.debug(
                        "V2 features updated",
                        market_count=len(self.active_markets)
                    )

            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("V2 feature update error", error=str(e))

            await asyncio.sleep(UPDATE_INTERVAL)

    async def build_real_world_state(self, market_id: str):
        """
        Build a real WorldState for the Council from live data.
        This is THE BRIDGE between data collection and Council deliberation.
        """
        from quant.council.agents import (
            WorldState, MarketMicrostructure, NarrativeState,
            OnChainState, PortfolioState
        )

        # Get market data
        cached = self.polymarket_client.get_cached()
        market = next((m for m in cached if m.id == market_id), None)
        if not market:
            return None

        # Get features if available
        features = None
        if self.feature_engineer:
            features = self.feature_engineer.compute(market_id)

        # Get narrative if available
        narrative = None
        if self.narrative_velocity:
            narrative = self.narrative_velocity.compute(market_id)

        # Build microstructure
        micro = MarketMicrostructure(
            order_book_imbalance=features.order_book_imbalance if features and features.is_valid else 0.0,
            volume_z_score=features.volume_z_score if features and features.is_valid else 0.0,
            momentum_1h=features.momentum_1h if features and features.is_valid else 0.0,
            momentum_4h=0.0,  # TODO: add 4h momentum
            momentum_24h=0.0,  # TODO: add 24h momentum
            spread_bps=features.spread_bps if features and features.is_valid else market.spread * 10000,
            liquidity_depth_usd=market.liquidity,
            price_reversion_score=0.0,  # TODO: compute mean reversion
        )

        # Build narrative state
        narr_state = NarrativeState(
            sentiment_score=features.sentiment_score if features and features.is_valid else 0.0,
            nvi_score=narrative.nvi_score if narrative else 0.0,
            novelty_index=0.5,  # Default
            credibility_factor=0.7,  # Default (news sources are generally credible)
            sarcasm_probability=0.1,  # Default low
            tweet_volume_z=0.0,  # TODO: add Twitter feed
            narrative_coherence=0.5,  # Default
        )

        # Build on-chain state (simplified without whale tracking)
        on_chain = OnChainState(
            smart_money_flow=0.0,   # TODO: add whale tracking
            whale_concentration=0.0,
            retail_flow=0.0,
            cross_platform_spread=0.0,
            gas_congestion_pct=0.0,
        )

        # Build portfolio state (use defaults if no portfolio)
        portfolio = PortfolioState(
            current_drawdown=0.0,
            correlated_exposure=0.0,
            leverage=0.0,
            sharpe_ratio=1.0,
            win_rate=0.5,
            time_to_resolution_hours=max(1.0, 24.0),  # TODO: compute from end_date
            implied_volatility=features.implied_volatility if features and features.is_valid else 0.3,
        )

        return WorldState(
            market_id=market_id,
            timestamp_ms=int(time.time() * 1000),
            mid_price=market.yes_price,
            micro=micro,
            narrative=narr_state,
            on_chain=on_chain,
            portfolio=portfolio,
        )


    async def _council_analysis_task(self) -> None:
        """Background task: Council AI analyzes top 30 markets every 5 minutes."""
        if not self.council:
            logger.info("Council analysis task disabled (council not initialized)")
            return

        # Check if this is the new CouncilAI (not the old quant.council.agents.TheCouncil)
        if not hasattr(self.council, 'analyze_batch'):
            logger.info("Council analysis task disabled (old council API, no analyze_batch)")
            return

        logger.info("🧠 Council analysis task started")

        # Small initial delay so polymarket client can warm up
        await asyncio.sleep(30)

        while True:
            try:
                # Get cached markets from polymarket client
                cached = self.polymarket_client.get_cached() if self.polymarket_client else []

                # Fallback: fetch directly from Gamma API if cache is empty
                if not cached:
                    try:
                        import httpx
                        import json as _json
                        async with httpx.AsyncClient(timeout=10) as hx:
                            r = await hx.get(
                                "https://gamma-api.polymarket.com/markets"
                                "?active=true&limit=30&order=volume24hr&ascending=false&closed=false"
                            )
                            if r.status_code == 200:
                                cached = r.json()
                    except Exception as fetch_err:
                        logger.warning("Council: Gamma API fallback failed", error=str(fetch_err))

                if cached:
                    # Sort by volume, take top 30 (support both dicts and objects)
                    def _vol(m):
                        v = m.get('volume24hr', 0) if isinstance(m, dict) else getattr(m, 'volume24hr', 0)
                        return float(v or 0)
                    top = sorted(cached, key=_vol, reverse=True)[:30]

                    markets_list = []
                    for m in top:
                        try:
                            # Support both object attributes and dict keys
                            def _get(key, default=""):
                                if isinstance(m, dict):
                                    return m.get(key, default)
                                return getattr(m, key, default)

                            raw_prices = _get('outcomePrices', '[]') or '[]'
                            if isinstance(raw_prices, str):
                                import json as _j
                                prices = [float(p) for p in _j.loads(raw_prices)]
                            elif isinstance(raw_prices, list):
                                prices = [float(p) for p in raw_prices]
                            else:
                                prices = []
                            markets_list.append({
                                "conditionId": _get('conditionId') or _get('id'),
                                "id": _get('id'),
                                "question": _get('question'),
                                "yesPrice": prices[0] if prices else 0.5,
                                "noPrice": prices[1] if len(prices) > 1 else 0.5,
                                "volume": float(_get('volume', 0) or 0),
                                "volume24hr": float(_get('volume24hr', 0) or 0),
                                "liquidity": float(_get('liquidity', 0) or 0),
                            })
                        except Exception:
                            continue

                    if markets_list:
                        decisions = await self.council.analyze_batch(markets_list)
                        logger.info(f"🧠 Council analyzed {len(decisions)} markets")
            except Exception as e:
                logger.error("Council analysis task error", error=str(e))

            await asyncio.sleep(300)  # Every 5 minutes


# Global state instance
state = AppState()


# =============================================================================
# Lifespan Management
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    await state.startup()
    yield
    # Shutdown
    await state.shutdown()


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="Black Edge",
    description="Quantitative Arbitrage Engine for Prediction Markets",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware - Allow Vercel domains and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.vercel.app",
        "https://black-edge.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",
)


# =============================================================================
# Routes
# =============================================================================

# Include routers (only if advanced features available)
if ADVANCED_FEATURES_AVAILABLE and arbitrage_router:
    app.include_router(arbitrage_router, prefix="/api/v1")
    logger.info("✅ Arbitrage router enabled")
else:
    logger.info("ℹ️ Arbitrage router disabled (numpy/pandas not available)")

# Include V2 router (always enabled)
try:
    from api.routes import router as v2_router
    app.include_router(v2_router)
    logger.info("✅ V2 API router enabled")
except Exception as e:
    logger.warning("⚠️ V2 API router disabled", error=str(e))


# Health check
@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "websocket_connections": ws_manager.connection_count,
        "tier_distribution": ws_manager.get_tier_counts(),
    }


# Root endpoint
@app.get("/")
async def root() -> dict:
    """Root endpoint with API info."""
    return {
        "name": "Black Edge",
        "version": "0.1.0",
        "status": "Beast Mode",
        "description": "Quantitative Arbitrage Engine for Prediction Markets",
        "docs": "/docs",
        "health": "/health",
        "websocket": "/ws/stream",
    }


# Public opportunities endpoint (no auth required - returns demo + live data)
@app.get("/api/opportunities")
async def list_opportunities_public() -> list[dict]:
    """
    Public endpoint for the terminal view.
    Returns live Polymarket signals enriched with Kelly/Arb/Volatility analysis,
    or demo data if no live data is available yet.
    """
    # Priority 1: Live Polymarket signals from the quant engine
    if state.live_signals:
        logger.debug("✅ Serving REAL Polymarket data", signal_count=len(state.live_signals))
        return [s.to_api_dict() for s in state.live_signals]

    # Priority 2: Arbitrage pipeline detections
    from routers.arbitrage import _active_opportunities

    if _active_opportunities:
        logger.debug("✅ Serving arbitrage detections", opp_count=len(_active_opportunities))
        return [
            {
                "id": opp.opportunity_id,
                "market": opp.market_ids[0] if opp.market_ids else "UNKNOWN",
                "question": "Arbitrage opportunity",
                "platform": "Polymarket",
                "url": "",
                "polyOdds": round((opp.observed_prices[0] if opp.observed_prices else 0.5) * 100),
                "trueProb": round((opp.projected_prices[0] if opp.projected_prices else 0.5) * 100),
                "edge": round((opp.profit_per_dollar or 0) * 100, 1),
                "volume": "$0",
                "volumeTotal": "$0",
                "liquidity": 0,
                "trend": "up" if (opp.profit_per_dollar or 0) > 0 else "down",
                "risk": "low" if opp.execution_risk < 0.3 else ("medium" if opp.execution_risk < 0.6 else "high"),
                "spread": 0,
                "kellyFraction": 0,
                "volatility": 0,
                "arbFlag": False,
                "arbDetail": "",
                "signalStrength": 50,
            }
            for opp in _active_opportunities.values()
        ]

    # Demo data while pipeline warms up
    logger.warning("⚠️ SERVING MOCK DATA - No live Polymarket signals available yet")
    return [
        {"id": "1", "market": "EPSTEIN_LIST_REVEAL", "question": "Will the Epstein list be revealed?", "platform": "Polymarket", "url": "", "polyOdds": 12, "trueProb": 18, "edge": 6, "volume": "$2.4M", "volumeTotal": "$14M", "liquidity": 320000, "trend": "up", "risk": "high", "spread": 0.03, "kellyFraction": 0.08, "volatility": 0.032, "arbFlag": False, "arbDetail": "", "signalStrength": 72},
        {"id": "2", "market": "FED_RATE_CUT_Q2", "question": "Fed rate cut in Q2 2026?", "platform": "Polymarket", "url": "", "polyOdds": 67, "trueProb": 71, "edge": 4, "volume": "$8.1M", "volumeTotal": "$42M", "liquidity": 890000, "trend": "up", "risk": "low", "spread": 0.01, "kellyFraction": 0.05, "volatility": 0.018, "arbFlag": False, "arbDetail": "", "signalStrength": 65},
        {"id": "3", "market": "CEO_INDICTMENT_TECH", "question": "Major tech CEO indicted in 2026?", "platform": "Polymarket", "url": "", "polyOdds": 34, "trueProb": 41, "edge": 7, "volume": "$1.2M", "volumeTotal": "$6M", "liquidity": 150000, "trend": "up", "risk": "medium", "spread": 0.04, "kellyFraction": 0.12, "volatility": 0.045, "arbFlag": False, "arbDetail": "", "signalStrength": 78},
        {"id": "4", "market": "TAIWAN_STRAIT_INCIDENT", "question": "Taiwan Strait military incident in 2026?", "platform": "Polymarket", "url": "", "polyOdds": 8, "trueProb": 5, "edge": -3, "volume": "$4.7M", "volumeTotal": "$18M", "liquidity": 520000, "trend": "down", "risk": "high", "spread": 0.06, "kellyFraction": 0, "volatility": 0.055, "arbFlag": False, "arbDetail": "", "signalStrength": 25},
        {"id": "5", "market": "BTC_100K_2026", "question": "Bitcoin above $100K by end of 2026?", "platform": "Polymarket", "url": "", "polyOdds": 45, "trueProb": 52, "edge": 7, "volume": "$12.3M", "volumeTotal": "$85M", "liquidity": 1200000, "trend": "up", "risk": "medium", "spread": 0.02, "kellyFraction": 0.10, "volatility": 0.028, "arbFlag": False, "arbDetail": "", "signalStrength": 81},
        {"id": "6", "market": "WHISTLEBLOWER_ALIVE", "question": "Key whistleblower confirmed alive?", "platform": "Polymarket", "url": "", "polyOdds": 78, "trueProb": 72, "edge": -6, "volume": "$890K", "volumeTotal": "$3M", "liquidity": 95000, "trend": "down", "risk": "high", "spread": 0.05, "kellyFraction": 0, "volatility": 0.061, "arbFlag": False, "arbDetail": "", "signalStrength": 18},
        {"id": "7", "market": "AI_REGULATION_US", "question": "US passes major AI regulation in 2026?", "platform": "Polymarket", "url": "", "polyOdds": 56, "trueProb": 61, "edge": 5, "volume": "$3.2M", "volumeTotal": "$21M", "liquidity": 410000, "trend": "up", "risk": "low", "spread": 0.02, "kellyFraction": 0.07, "volatility": 0.015, "arbFlag": False, "arbDetail": "", "signalStrength": 68},
        {"id": "8", "market": "PANDEMIC_LAB_LEAK", "question": "Lab leak origin confirmed officially?", "platform": "Polymarket", "url": "", "polyOdds": 41, "trueProb": 48, "edge": 7, "volume": "$5.6M", "volumeTotal": "$32M", "liquidity": 670000, "trend": "up", "risk": "medium", "spread": 0.03, "kellyFraction": 0.11, "volatility": 0.035, "arbFlag": True, "arbDetail": "Underpriced: YES(0.41) + NO(0.52) = 0.93 < 1.0", "signalStrength": 85},
    ]


class BuildTxRequest(BaseModel):
    user_address: str
    market_id: str
    outcome: str
    amount: float


# Build transaction endpoint - THE CORE EXECUTION ROUTE
@app.post("/api/build-tx")
async def build_transaction(request: BuildTxRequest) -> dict:
    """
    Build an unsigned transaction for Polymarket trade execution.

    The frontend calls this, receives the tx data, and asks the user's wallet to sign it.
    This keeps private keys on the user's side (secure).

    Args:
        user_address: User's wallet address
        market_id: Polymarket market condition ID
        outcome: "YES" or "NO"
        amount: Amount to trade in USDC

    Returns:
        Unsigned transaction dict ready for wallet signing
    """
    from engine.polymarket_trade import PolymarketTradeBuilder
    import os

    try:
        rpc_url = os.getenv("POLYGON_RPC_URL", "https://polygon-rpc.com")
        trade_builder = PolymarketTradeBuilder(rpc_url)

        # Convert outcome to index (0 = NO, 1 = YES)
        outcome_index = 1 if request.outcome.upper() == "YES" else 0

        unsigned_tx = trade_builder.build_buy_transaction(
            user_address=request.user_address,
            condition_id=request.market_id,
            outcome_index=outcome_index,
            amount_usdc=request.amount,
            max_price=1.0  # Accept current market price
        )

        if "error" in unsigned_tx:
            logger.error("Failed to build transaction", error=unsigned_tx["error"])
            return unsigned_tx

        logger.info(
            "Transaction built successfully",
            user=request.user_address[:10],
            market=request.market_id[:10],
            outcome=request.outcome,
            amount=request.amount
        )

        return unsigned_tx

    except Exception as e:
        logger.error("Failed to build transaction", error=str(e))
        return {"error": str(e)}


@app.get("/api/markets")
async def get_polymarket_markets():
    """
    Fetch all active markets directly from Polymarket Gamma API, including images.
    Returns 100 markets sorted by 24h volume.
    """
    import httpx
    import json as json_lib

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://gamma-api.polymarket.com/markets",
                params={
                    "limit": 100,
                    "active": "true",
                    "closed": "false",
                    "archived": "false",
                    "order": "volume24hr",
                    "ascending": "false",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        markets = []
        for m in data:
            if m.get("closed") or not m.get("active", True):
                continue

            outcome_prices = m.get("outcomePrices", [])
            yes_price = 0.5
            no_price = 0.5
            if outcome_prices and len(outcome_prices) >= 2:
                try:
                    yes_price = float(outcome_prices[0])
                    no_price = float(outcome_prices[1])
                except (ValueError, TypeError):
                    pass

            outcomes = m.get("outcomes", ["Yes", "No"])
            if isinstance(outcomes, str):
                try:
                    outcomes = json_lib.loads(outcomes)
                except Exception:
                    outcomes = ["Yes", "No"]

            slug = m.get("slug", "")
            markets.append({
                "id": m.get("conditionId", m.get("id", "")),
                "question": m.get("question", ""),
                "image": m.get("image", ""),
                "icon": m.get("icon", ""),
                "slug": slug,
                "url": f"https://polymarket.com/event/{slug}",
                "yes_price": yes_price,
                "no_price": no_price,
                "volume_24h": float(m.get("volume24hr", 0) or 0),
                "volume_total": float(m.get("volumeNum", 0) or 0),
                "liquidity": float(m.get("liquidityNum", 0) or 0),
                "end_date": m.get("endDate", ""),
                "outcomes": (outcomes[:2] if len(outcomes) >= 2 else ["Yes", "No"]),
            })

        logger.info("Served Polymarket markets", count=len(markets))
        return {"markets": markets, "count": len(markets)}

    except Exception as e:
        logger.error("Failed to fetch Polymarket markets", error=str(e))
        return {"markets": [], "count": 0, "error": str(e)}


@app.post("/api/check-approval")
async def check_approval(user_address: str) -> dict:
    """
    Check if user has approved USDC for Polymarket CTF Exchange.

    Args:
        user_address: User's wallet address

    Returns:
        Approval status and amount
    """
    from engine.polymarket_trade import PolymarketTradeBuilder
    import os

    try:
        rpc_url = os.getenv("POLYGON_RPC_URL", "https://polygon-rpc.com")
        trade_builder = PolymarketTradeBuilder(rpc_url)

        result = trade_builder.check_approval(user_address)
        return result

    except Exception as e:
        logger.error("Failed to check approval", error=str(e))
        return {"error": str(e)}


@app.post("/api/build-approval")
async def build_approval(user_address: str) -> dict:
    """
    Build USDC approval transaction for Polymarket CTF Exchange.

    Args:
        user_address: User's wallet address

    Returns:
        Unsigned approval transaction
    """
    from engine.polymarket_trade import PolymarketTradeBuilder
    import os

    try:
        rpc_url = os.getenv("POLYGON_RPC_URL", "https://polygon-rpc.com")
        trade_builder = PolymarketTradeBuilder(rpc_url)

        unsigned_tx = trade_builder.build_approval_transaction(user_address)

        if "error" in unsigned_tx:
            logger.error("Failed to build approval", error=unsigned_tx["error"])
            return unsigned_tx

        logger.info("Approval transaction built", user=user_address[:10])
        return unsigned_tx

    except Exception as e:
        logger.error("Failed to build approval", error=str(e))
        return {"error": str(e)}


@app.post("/api/subscribe")
async def subscribe_to_waitlist(email: str) -> dict:
    """
    Add user to waitlist and send welcome email.

    Args:
        email: User's email address

    Returns:
        Success status with queue position
    """
    try:
        if not email or '@' not in email:
            return {
                "status": "error",
                "error": "Invalid email address"
            }

        result = await state.email_service.add_to_waitlist(email)
        logger.info(
            "Waitlist signup",
            email=email,
            position=result.get("queue_position"),
            status=result.get("status")
        )

        return result

    except Exception as e:
        logger.error("Waitlist signup failed", error=str(e))
        return {
            "status": "error",
            "error": "Failed to process signup. Please try again."
        }


# =============================================================================
# Grok xAI Endpoints
# =============================================================================

@app.get("/api/grok/analyze/{condition_id}")
async def grok_analyze(condition_id: str) -> dict:
    """
    Use Grok AI to analyze a specific Polymarket condition.

    Returns edge_assessment, risk_factor, confidence, direction, reasoning.
    """
    from engine.grok_analyzer import get_analyzer
    import os as _os

    try:
        # Find the market in cache
        market = None
        cached = state.polymarket_client.get_cached() if state.polymarket_client else []
        for m in cached:
            if m.condition_id == condition_id or m.id == condition_id:
                market = m
                break

        if not market:
            raise HTTPException(status_code=404, detail=f"Market {condition_id} not found in cache")

        analyzer = get_analyzer()
        result = await analyzer.analyze_market(
            question=market.question,
            yes_price=market.yes_price,
            volume=market.volume_24h,
        )

        return {
            "condition_id": condition_id,
            "question": market.question,
            "yes_price": market.yes_price,
            "analysis": result,
            "model": "grok-3-mini",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Grok analyze failed", condition_id=condition_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/grok/commentary")
async def grok_commentary() -> dict:
    """
    Use Grok AI to generate market commentary from top signals.

    Returns 2-3 sentence commentary string.
    """
    from engine.grok_analyzer import get_analyzer

    try:
        signals_data = []
        for sig in state.live_signals[:5]:
            d = sig.to_api_dict()
            signals_data.append({
                "question": d.get("question", ""),
                "edge": d.get("edge", 0),
                "direction": "YES" if d.get("kelly_edge", 0) > 0 else "NO",
            })

        analyzer = get_analyzer()
        commentary = await analyzer.generate_commentary(signals_data)

        return {
            "commentary": commentary,
            "signal_count": len(signals_data),
            "model": "grok-3-mini",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error("Grok commentary failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket endpoint
@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for real-time arbitrage streaming.

    Connect with optional token query parameter for authentication:
    ws://localhost:8000/ws/stream?token=YOUR_FIREBASE_TOKEN

    Or authenticate after connection with:
    {"type": "auth", "token": "YOUR_FIREBASE_TOKEN"}

    Subscribe to specific markets:
    {"type": "subscribe", "markets": ["market_id_1", "market_id_2"]}
    """
    await websocket_handler(websocket)


# V2 WebSocket endpoint (multiplexed stream)
@app.websocket("/api/v2/ws")
async def websocket_v2_endpoint(websocket: WebSocket) -> None:
    """
    V2 WebSocket endpoint for multiplexed real-time streaming.

    Streams:
    - signal_update: New signal every 10 seconds
    - whale_alert: When whale trades
    - narrative_shift: When NVI accelerates
    - risk_warning: When Doomer flags

    Format: {"type": "signal_update", "data": {...}}
    """
    from api.websocket_v2 import websocket_handler_v2
    await websocket_handler_v2(websocket)


# =============================================================================
# Error Handlers
# =============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception) -> JSONResponse:
    """Global exception handler."""
    logger.error(
        "Unhandled exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
        log_level="info",
    )
