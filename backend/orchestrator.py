"""
Black Edge Orchestrator V4 — Dual-Engine Production System
==========================================================
Two paths:
  NEWS     → Gemini scan → GPT-4o analyse → CouncilDecision → Kelly → Execute
  CRYPTO   → BTC filter → Binance live price → Math edge → Kelly → Execute

Continuous loop — once ARMED, scans every 60s without human intervention.
Real balance awareness — fetches USDC collateral before sizing.
WebSocket status sync — emits HUNTING_ALPHA / SCANNING_NOISE for frontend glow.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
import structlog

from ai.council import (
    AlphaCandidate,
    CouncilDecision,
    MarketSummary,
    analyze_candidate,
    scan_for_alpha,
)
from api.websocket_manager import engine_logs_manager
from db.credentials import get_polymarket_credentials_decrypted
from db.models import BotInstance, BotStatus, TradeLog, init_db
from db.session import get_session

logger = structlog.get_logger()

_scanner_task: Optional[asyncio.Task] = None

GAMMA_API_URL = "https://gamma-api.polymarket.com/markets"
BINANCE_PRICE_URL = "https://api.binance.com/api/v3/ticker/price"
DRY_RUN = os.environ.get("POLYMARKET_DRY_RUN", "true").lower() == "true"

# Market classification tag
MARKET_TAG_NEWS = "NEWS"
MARKET_TAG_CRYPTO = "CRYPTO_PRICE"


# =============================================================================
# WebSocket log + status protocol
# =============================================================================


async def _log(user_id: int, message: str) -> None:
    """Send structured log message to user's terminal. Never logs PII."""
    await engine_logs_manager.send_personal_message(message, user_id)


async def _broadcast_log(user_ids: list[int], message: str) -> None:
    """Broadcast same log to multiple users simultaneously."""
    await asyncio.gather(*[_log(uid, message) for uid in user_ids], return_exceptions=True)


async def _broadcast_status(
    user_ids: list[int],
    status: str,
    is_thinking: bool,
    extra: dict | None = None,
) -> None:
    """Broadcast engine status to all users for frontend glow sync."""
    await engine_logs_manager.broadcast_status(user_ids, status, is_thinking, extra)


# =============================================================================
# BTC Strike Price Parser
# =============================================================================

_PRICE_PATTERNS = [
    re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*[Kk]", re.IGNORECASE),  # $120K
    re.compile(r"\$\s*([\d,]+(?:\.\d+)?)"),                         # $120,000
    re.compile(r"([\d,]+(?:\.\d+)?)\s*dollars", re.IGNORECASE),
]


def _parse_strike_price(question: str) -> Optional[float]:
    """Extract a dollar strike price from a market question."""
    for pat in _PRICE_PATTERNS:
        m = pat.search(question)
        if m:
            raw = m.group(1).replace(",", "")
            val = float(raw)
            # Handle "K" suffix
            if "k" in m.group(0).lower() and val < 10_000:
                val *= 1_000
            return val
    return None


def _classify_market(question: str, slug: str = "") -> str:
    """Tag a market as CRYPTO_PRICE or NEWS."""
    combined = (question + " " + slug).lower()
    btc_keywords = ["bitcoin", "btc", " btc ", "btc above", "btc below", "bitcoin price"]
    if any(kw in combined for kw in btc_keywords):
        if _parse_strike_price(question) is not None:
            return MARKET_TAG_CRYPTO
    return MARKET_TAG_NEWS


# =============================================================================
# Live BTC Price (Binance — public, no auth)
# =============================================================================


async def _fetch_btc_price() -> Optional[float]:
    """Fetch realtime BTC/USDT price from Binance."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(BINANCE_PRICE_URL, params={"symbol": "BTCUSDT"})
            resp.raise_for_status()
            return float(resp.json()["price"])
    except Exception as e:
        logger.warning("Binance BTC price fetch failed", error=str(e))
        return None


# =============================================================================
# Polymarket market fetch (50 markets)
# =============================================================================


async def _fetch_markets(limit: int = 50) -> list[dict]:
    """
    Fetch top markets from Polymarket Gamma API.
    Returns raw dicts with extra metadata (slug, end_date) for classification.
    """
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                GAMMA_API_URL,
                params={
                    "limit": limit,
                    "order": "volume24hr",
                    "ascending": "false",
                    "closed": "false",
                    "active": "true",
                },
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error("Polymarket fetch failed", error=str(e))
        return []


def _raw_to_summary(m: dict) -> Optional[MarketSummary]:
    """Convert Gamma API raw dict to MarketSummary."""
    try:
        raw_prices = m.get("outcomePrices", "[]")
        prices = json.loads(raw_prices) if isinstance(raw_prices, str) else (raw_prices or [])
        yes_price = float(prices[0]) if prices else 0.5

        return MarketSummary(
            market_id=m.get("conditionId", m.get("id", "")),
            question=m.get("question", ""),
            description=(m.get("description", "") or "")[:500],
            yes_price=yes_price,
            volume24hr=float(m.get("volume24hr", 0) or 0),
            liquidity=float(m.get("liquidityNum", m.get("liquidity", 0)) or 0),
        )
    except (json.JSONDecodeError, ValueError, TypeError):
        return None


# =============================================================================
# Crypto Edge Evaluator (bypasses Perplexity/LLM)
# =============================================================================


async def evaluate_crypto_edge(
    market: MarketSummary,
    slug: str = "",
) -> Optional[CouncilDecision]:
    """
    Quantitative BTC edge detection.
    1. Parse strike price from question.
    2. Fetch live BTC price from Binance.
    3. If live price creates mathematical edge against market yes/no price → signal.
    """
    strike = _parse_strike_price(market.question)
    if strike is None:
        return None

    btc_price = await _fetch_btc_price()
    if btc_price is None:
        return None

    # Determine direction: "above" → YES means BTC > strike
    q_lower = market.question.lower()
    is_above_market = "above" in q_lower or "over" in q_lower or "higher" in q_lower

    if is_above_market:
        # If BTC is well above strike, YES should be near 1.0
        true_probability = min(0.98, max(0.02, 0.5 + (btc_price - strike) / strike * 2.5))
    else:
        # "below" market — YES means BTC < strike
        true_probability = min(0.98, max(0.02, 0.5 + (strike - btc_price) / strike * 2.5))

    market_price = market.yes_price
    edge_pct = (true_probability - market_price) * 100

    # Need at least 5% edge to act
    if abs(edge_pct) < 5.0:
        return None

    if edge_pct > 0:
        side = "YES"
        ia_prob = true_probability
    else:
        side = "NO"
        ia_prob = 1 - true_probability
        edge_pct = abs(edge_pct)

    confidence = min(0.95, edge_pct / 100 * 2 + 0.5)

    logger.info(
        "[CRYPTO] Math edge detected",
        strike=strike,
        btc_price=btc_price,
        ia_prob=round(ia_prob, 3),
        market_price=round(market_price, 3),
        edge_pct=round(edge_pct, 1),
        side=side,
    )

    return CouncilDecision(
        market_id=market.market_id,
        question=market.question,
        ia_probability=ia_prob,
        confidence=confidence,
        recommended_side=side,
        market_price=market_price,
        edge_pct=round(edge_pct, 1),
        reasoning=f"[MATH] BTC=${btc_price:,.0f} vs strike=${strike:,.0f} → {side} edge {edge_pct:.1f}%",
    )


# =============================================================================
# Kelly Criterion
# =============================================================================


def _kelly_size(
    bankroll: float,
    ia_probability: float,
    market_price: float,
    side: str,
    fraction: float = 0.25,
) -> float:
    """
    Fractional Kelly: f* = (bp - q) / b
    Hard-capped at 5% of bankroll per trade.
    Returns 0 if edge is negative.
    """
    if side == "YES":
        p = ia_probability
        b = (1 - market_price) / market_price if market_price > 0 else 1
    else:
        p = 1 - ia_probability
        b = market_price / (1 - market_price) if market_price < 1 else 1

    q = 1 - p
    f = (b * p - q) / b if b > 0 else 0
    f = max(0.0, min(f * fraction, 0.05)) * bankroll
    return round(f, 2)


# =============================================================================
# Real USDC Balance Fetch
# =============================================================================


async def _get_usdc_balance(proxy_key: str, secret: str, passphrase: str) -> float:
    """
    Fetch real USDC collateral balance from Polymarket CLOB.
    Returns 0.0 on any error (user sees it in logs).
    """
    try:
        from py_clob_client.client import ClobClient

        clob = ClobClient(
            host="https://clob.polymarket.com",
            key=proxy_key,
            chain_id=137,
        )
        # Derive address
        addr = clob.get_address()
        balance_data = clob.get_collateral_balance(addr)
        return float(balance_data.get("balance", 0)) / 1e6
    except Exception as e:
        logger.warning("USDC balance fetch failed", error=str(e))
        return 0.0


# =============================================================================
# Worker — Execute for one user
# =============================================================================


async def _execute_for_user(user_id: int, decision: CouncilDecision) -> None:
    """
    Full execution pipeline for a single user.
    Isolated — exception here never affects other users.
    Keys are decrypted in-memory, used once, discarded.
    """
    try:
        init_db()
        with get_session() as session:
            creds = get_polymarket_credentials_decrypted(session, user_id)
            if not creds:
                await _log(user_id, "[WARNING] No Polymarket API keys. Go to Settings → Setup to enter your keys.")
                return

            proxy_key, secret, passphrase, polygon_pk = creds

            # Real balance from CLOB
            bankroll = await _get_usdc_balance(proxy_key, secret, passphrase)
            if bankroll <= 0:
                await _log(user_id, "[WARNING] Vault balance is $0.00 — cannot size trades. Deposit USDC to your Polymarket account.")
                del proxy_key, secret, passphrase, polygon_pk
                return

            # Emit balance to frontend
            await engine_logs_manager.send_status(
                user_id, "BALANCE_UPDATE", False, {"usdcBalance": round(bankroll, 2)}
            )

            await _log(user_id, f"[VAULT] Available liquidity: ${bankroll:.2f}")

            size = _kelly_size(
                bankroll=bankroll,
                ia_probability=decision.ia_probability,
                market_price=decision.market_price,
                side=decision.recommended_side,
            )

            # Clamp to actual balance
            size = min(size, bankroll)

            await _log(user_id, f"[RISK] Kelly suggests {size/bankroll*100:.1f}% allocation (${size:.2f})")

            if size <= 0:
                await _log(user_id, "[SKIP] Kelly = $0 — edge insufficient for position sizing")
                del proxy_key, secret, passphrase, polygon_pk
                return

            if DRY_RUN:
                await _log(
                    user_id,
                    f"[SIMULATION] Would buy ${size:.2f} of {decision.recommended_side} "
                    f"at {decision.market_price:.3f} — Market: {decision.question[:50]}",
                )
                logger.info(
                    "[SIMULATION] DRY_RUN trade",
                    user_id=user_id,
                    side=decision.recommended_side,
                    size=size,
                    market_id=decision.market_id[:16],
                )
            else:
                # ── LIVE EXECUTION ──────────────────────────────────────
                await _log(user_id, f"[EXECUTION] Submitting order to Polymarket CLOB...")
                order_id = None
                exec_error = None
                try:
                    from py_clob_client.client import ClobClient
                    from py_clob_client.clob_types import OrderArgs, OrderType

                    # Use HMAC credentials (proxy_key, secret, passphrase) for L2 auth
                    # and polygon_pk for L1 EIP-712 signing
                    clob = ClobClient(
                        host="https://clob.polymarket.com",
                        key=proxy_key,
                        chain_id=137,
                    )
                    # Set L2 HMAC creds
                    clob.set_api_creds(
                        ClobClient.derive_api_creds(clob, key=proxy_key, secret=secret, passphrase=passphrase)
                    )

                    # Determine token_id — we need the YES or NO token
                    # The market_id is the conditionId; fetch market to get token IDs
                    market_resp = None
                    async with httpx.AsyncClient(timeout=10.0) as http:
                        resp = await http.get(
                            GAMMA_API_URL,
                            params={"condition_id": decision.market_id, "limit": 1},
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            if data:
                                market_resp = data[0]

                    if not market_resp:
                        await _log(user_id, f"[ERROR] Could not resolve token IDs for market {decision.market_id[:16]}")
                        del proxy_key, secret, passphrase, polygon_pk
                        return

                    raw_tokens = market_resp.get("clobTokenIds", "[]")
                    tokens = json.loads(raw_tokens) if isinstance(raw_tokens, str) else (raw_tokens or [])

                    if len(tokens) < 2:
                        await _log(user_id, f"[ERROR] Market has no CLOB tokens")
                        del proxy_key, secret, passphrase, polygon_pk
                        return

                    # tokens[0] = YES, tokens[1] = NO
                    token_id = tokens[0] if decision.recommended_side == "YES" else tokens[1]

                    buy_price = decision.market_price if decision.recommended_side == "YES" else (1 - decision.market_price)

                    order_args = OrderArgs(
                        token_id=token_id,
                        price=round(buy_price, 2),
                        size=round(size, 2),
                        side="BUY",
                        fee_rate_bps=0,
                    )

                    signed_order = clob.create_order(order_args)
                    resp = clob.post_order(signed_order, OrderType.FOK)
                    order_id = resp.get("orderID")

                    if order_id:
                        await _log(user_id, f"[SUCCESS] Order filled: {order_id}")
                    else:
                        exec_error = resp.get("errorMsg", str(resp))
                        await _log(user_id, f"[FAIL] Order rejected: {exec_error}")

                except Exception as e:
                    exec_error = str(e)
                    await _log(user_id, f"[ERROR] Execution failed: {exec_error}")
                    logger.error("[EXECUTION] Live trade error", user_id=user_id, error=exec_error)

            # Purge keys immediately after use
            del proxy_key, secret, passphrase, polygon_pk

            # Persist trade log
            trade = TradeLog(
                user_id=user_id,
                market_id=decision.market_id,
                market_question=decision.question,
                side=decision.recommended_side,
                size_usd=size,
                price=decision.market_price,
                ia_probability=decision.ia_probability,
                confidence=decision.confidence,
                kelly_fraction=0.25,
                status="DRY_RUN" if DRY_RUN else ("FILLED" if not DRY_RUN and (order_id if not DRY_RUN else None) else "FAILED"),
                pnl=0.0,
            )
            session.add(trade)

            # Update heartbeat
            bot = session.query(BotInstance).filter(BotInstance.user_id == user_id).first()
            if bot:
                bot.last_heartbeat = datetime.now(timezone.utc)
                bot.last_log = (
                    f"{'[SIM]' if DRY_RUN else '[LIVE]'} "
                    f"{decision.recommended_side} ${size:.2f} — {decision.question[:40]}..."
                )

            await _log(user_id, f"[OK] Trade logged. Cycle complete.")

    except Exception as e:
        logger.error("Worker error", user_id=user_id, error=str(e))
        await _log(user_id, f"[ERROR] Worker cycle failed: {str(e)[:100]}")
        try:
            with get_session() as session:
                bot = session.query(BotInstance).filter(BotInstance.user_id == user_id).first()
                if bot:
                    bot.status = BotStatus.ERROR
                    bot.last_log = f"Error: {str(e)[:80]}"
        except Exception:
            pass


# =============================================================================
# Execution Engine — fan-out to all RUNNING users
# =============================================================================


def _get_running_users() -> list[dict]:
    """Return list of dicts with user_id + per-user strategy flags."""
    try:
        init_db()
        with get_session() as session:
            bots = session.query(BotInstance).filter(BotInstance.status == BotStatus.RUNNING).all()
            return [
                {
                    "user_id": b.user_id,
                    "strategy_news": getattr(b, "strategy_news", True),
                    "strategy_crypto": getattr(b, "strategy_crypto", True),
                }
                for b in bots
            ]
    except Exception:
        return []


async def _run_execution_engine(decision: CouncilDecision, user_ids: list[int]) -> None:
    """Fan-out decision to target users via asyncio.gather."""
    if not user_ids:
        logger.info("[ENGINE] No eligible users for this path")
        return

    logger.info("[ENGINE] Dispatching", users=len(user_ids), edge=decision.edge_pct)

    await _broadcast_log(
        user_ids,
        f"[ALPHA] Potential detected on '{decision.question[:50]}' — "
        f"Confidence: {int(decision.confidence*100)}% | Edge: {decision.edge_pct:.1f}%",
    )

    # Scale to 1000 users: gather runs all workers in parallel
    await asyncio.gather(
        *[_execute_for_user(uid, decision) for uid in user_ids],
        return_exceptions=True,
    )


# =============================================================================
# Global Scanner Loop (Dual-Engine Master)
# =============================================================================


async def global_scanner_loop() -> None:
    """
    Production master loop — runs continuously while any user is ARMED.
    Every 60s:
      1. Fetch 50 markets from Polymarket Gamma API
      2. Classify each as NEWS or CRYPTO_PRICE
      3. CRYPTO path: evaluate_crypto_edge (Binance math) — only for users with strategy_crypto=True
      4. NEWS path: Gemini scan → GPT-4o analysis — only for users with strategy_news=True
      5. Fan-out winning decisions to eligible users only
    """
    logger.info("[SCAN] Black Edge dual-engine V4 online")

    while True:
        try:
            running_users = _get_running_users()

            if not running_users:
                # No armed users — sleep and check again
                await asyncio.sleep(10)
                continue

            all_user_ids = [u["user_id"] for u in running_users]
            crypto_user_ids = [u["user_id"] for u in running_users if u["strategy_crypto"]]
            news_user_ids = [u["user_id"] for u in running_users if u["strategy_news"]]

            # ── HUNTING phase ──
            await _broadcast_status(all_user_ids, "HUNTING_ALPHA", True)
            await _broadcast_log(all_user_ids, "[SCAN] Analyzing Polymarket volume...")

            # Step 1: Fetch markets
            raw_markets = await _fetch_markets(limit=50)
            if not raw_markets:
                logger.warning("[SCAN] No markets fetched — retrying in 60s")
                await _broadcast_status(all_user_ids, "SCANNING_NOISE", False)
                await asyncio.sleep(60)
                continue

            # Step 2: Classify
            crypto_markets: list[tuple[MarketSummary, str]] = []
            news_markets: list[MarketSummary] = []

            for raw in raw_markets:
                summary = _raw_to_summary(raw)
                if not summary:
                    continue
                slug = raw.get("slug", "")
                tag = _classify_market(summary.question, slug)
                if tag == MARKET_TAG_CRYPTO:
                    crypto_markets.append((summary, slug))
                else:
                    news_markets.append(summary)

            logger.info(
                "[SCAN] Markets classified",
                crypto=len(crypto_markets),
                news=len(news_markets),
            )

            # ── CRYPTO PATH (fast, no LLM) — only for users with Crypto engine ON ──
            if crypto_user_ids and crypto_markets:
                await _broadcast_log(
                    crypto_user_ids,
                    f"[CRYPTO] Engine active — scanning {len(crypto_markets)} BTC markets...",
                )
                crypto_decision: Optional[CouncilDecision] = None
                for mkt, slug in crypto_markets:
                    await _broadcast_log(
                        crypto_user_ids,
                        f"[CRYPTO] Evaluating BTC market: {mkt.question[:55]}...",
                    )
                    crypto_decision = await evaluate_crypto_edge(mkt, slug)
                    if crypto_decision:
                        await _broadcast_log(
                            crypto_user_ids,
                            f"[EDGE] BTC math edge: {crypto_decision.edge_pct:.1f}% "
                            f"({crypto_decision.recommended_side}) — {crypto_decision.reasoning}",
                        )
                        break

                if crypto_decision:
                    await _run_execution_engine(crypto_decision, crypto_user_ids)
            elif crypto_markets and not crypto_user_ids:
                logger.info("[SCAN] Crypto markets found but no users have Crypto engine enabled")

            # ── NEWS PATH (LLM-powered) — only for users with News engine ON ──
            if news_user_ids and news_markets:
                await _broadcast_log(
                    news_user_ids,
                    f"[SCAN] Scanning {len(news_markets)} news markets via AI Council...",
                )

                candidates: list[AlphaCandidate] = await scan_for_alpha(news_markets)

                if candidates:
                    news_decision: Optional[CouncilDecision] = None
                    for candidate in candidates:
                        await _broadcast_log(
                            news_user_ids,
                            f"[SCAN] Reviewing: {candidate.market.question[:60]}... "
                            f"(scanner confidence: {int(candidate.scanner_confidence * 100)}%)",
                        )
                        news_decision = await analyze_candidate(candidate)
                        if news_decision:
                            break

                    if news_decision:
                        await _run_execution_engine(news_decision, news_user_ids)
                    else:
                        await _broadcast_log(news_user_ids, "[SCAN] News candidates analyzed — no trade signal.")
                else:
                    await _broadcast_log(news_user_ids, "[SCAN] No alpha candidates this cycle.")
            elif news_markets and not news_user_ids:
                logger.info("[SCAN] News markets found but no users have News engine enabled")

            # ── IDLE phase ──
            await _broadcast_status(all_user_ids, "SCANNING_NOISE", False)
            await _broadcast_log(all_user_ids, "[SCAN] Cycle complete. Next scan in 60s.")

        except asyncio.CancelledError:
            logger.info("[SCAN] Global scanner cancelled")
            raise
        except Exception as e:
            logger.error("[SCAN] Master loop error", error=str(e))
            try:
                running_users = _get_running_users()
                all_user_ids = [u["user_id"] for u in running_users]
                await _broadcast_status(all_user_ids, "SCANNING_NOISE", False)
            except Exception:
                pass

        await asyncio.sleep(60)


# =============================================================================
# Lifecycle
# =============================================================================


def start_scanner() -> asyncio.Task:
    global _scanner_task
    _scanner_task = asyncio.create_task(global_scanner_loop())
    return _scanner_task


async def stop_scanner() -> None:
    global _scanner_task
    if _scanner_task:
        _scanner_task.cancel()
        try:
            await _scanner_task
        except asyncio.CancelledError:
            pass
        _scanner_task = None
        logger.info("[SCAN] Global scanner stopped")
