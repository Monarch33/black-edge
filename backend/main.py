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
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, WebSocket
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


# Build transaction endpoint - THE CORE EXECUTION ROUTE
@app.post("/api/build-tx")
async def build_transaction(
    user_address: str,
    market_id: str,
    outcome: str,  # "YES" or "NO"
    amount: float  # Amount in USDC
) -> dict:
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
        outcome_index = 1 if outcome.upper() == "YES" else 0

        unsigned_tx = trade_builder.build_buy_transaction(
            user_address=user_address,
            condition_id=market_id,
            outcome_index=outcome_index,
            amount_usdc=amount,
            max_price=1.0  # Accept current market price
        )

        if "error" in unsigned_tx:
            logger.error("Failed to build transaction", error=unsigned_tx["error"])
            return unsigned_tx

        logger.info(
            "Transaction built successfully",
            user=user_address[:10],
            market=market_id[:10],
            outcome=outcome,
            amount=amount
        )

        return unsigned_tx

    except Exception as e:
        logger.error("Failed to build transaction", error=str(e))
        return {"error": str(e)}


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
