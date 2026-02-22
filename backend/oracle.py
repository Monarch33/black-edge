"""
oracle.py — AI Prediction Oracle for Non-Crypto Polymarket Markets
==================================================================
An autonomous agent pipeline that:
  1. Fetches active political / cultural / sports markets from Gamma API.
  2. Retrieves real-time context for each market (mock by default; plug in
     a real News API / Perplexity call by replacing `fetch_real_time_context`).
  3. Asks Claude to evaluate the probability and confidence as strict JSON.
  4. Compares the LLM probability with the current Polymarket YES price.
  5. Executes a BUY via py_clob_client when edge > ORACLE_MIN_EDGE and
     confidence > ORACLE_MIN_CONFIDENCE.

Usage:
    # Simulation (default – no real money):
    python oracle.py

    # Live execution:
    ORACLE_DRY_RUN=false python oracle.py

    # One-shot (useful for cron / Railway cron jobs):
    python oracle.py --once
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import httpx
import structlog
from dotenv import load_dotenv

# ── Resolve .env.local (same search order as config.py) ─────────────────────
def _load_env() -> None:
    root = Path(__file__).resolve().parent
    for p in [root / ".env.local", root.parent / ".env.local", root / ".env"]:
        if p.exists():
            load_dotenv(p, override=False)
            break

_load_env()

# ── Lazy import of Anthropic SDK (graceful error if not installed) ────────────
try:
    import anthropic as _anthropic_lib
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False

# ── Lazy import of TradeExecutor from local backend ──────────────────────────
# Allows running `python oracle.py` from any cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from engine.trade_executor import TradeExecutor  # noqa: E402

logger = structlog.get_logger("oracle")

# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class OracleConfig:
    """All tunable parameters read from environment / .env.local."""

    # Anthropic
    anthropic_api_key: str   = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    openai_api_key: str      = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    llm_model: str           = field(default_factory=lambda: os.getenv("LLM_MODEL", "claude-sonnet-4-5"))

    # Edge / risk thresholds
    min_edge: float          = field(default_factory=lambda: float(os.getenv("ORACLE_MIN_EDGE", "0.15")))
    min_confidence: float    = field(default_factory=lambda: float(os.getenv("ORACLE_MIN_CONFIDENCE", "0.80")))
    max_position_usdc: float = field(default_factory=lambda: float(os.getenv("ORACLE_MAX_POSITION_USDC", "50.0")))
    bankroll_fraction: float = field(default_factory=lambda: float(os.getenv("ORACLE_BANKROLL_FRACTION", "0.05")))

    # Loop / discovery
    loop_interval_secs: int  = field(default_factory=lambda: int(os.getenv("ORACLE_LOOP_INTERVAL_SECS", "300")))
    markets_limit: int       = field(default_factory=lambda: int(os.getenv("ORACLE_MARKETS_LIMIT", "30")))

    # Execution mode
    dry_run: bool            = field(default_factory=lambda: os.getenv("ORACLE_DRY_RUN", "true").lower() != "false")

    # Polymarket credentials
    private_key: str         = field(default_factory=lambda: os.getenv("POLYMARKET_PRIVATE_KEY", ""))

    # Optional context providers
    newsapi_key: str         = field(default_factory=lambda: os.getenv("NEWSAPI_KEY", ""))
    perplexity_api_key: str  = field(default_factory=lambda: os.getenv("PERPLEXITY_API_KEY", ""))

    def validate(self) -> None:
        """Raise if critical keys are missing."""
        if not self.anthropic_api_key and not self.openai_api_key:
            raise EnvironmentError(
                "Oracle requires ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local"
            )
        if not self.dry_run and not self.private_key:
            raise EnvironmentError(
                "ORACLE_DRY_RUN=false requires POLYMARKET_PRIVATE_KEY in .env.local"
            )


# =============================================================================
# NON-CRYPTO MARKET FILTER
# =============================================================================

# Markets whose questions contain any of these keywords are skipped.
_CRYPTO_KEYWORDS: frozenset[str] = frozenset({
    "bitcoin", "btc", "ethereum", "eth", "crypto", "solana", "sol",
    "xrp", "ripple", "dogecoin", "doge", "bnb", "binance", "usdc",
    "usdt", "stablecoin", "defi", "nft", "web3", "blockchain",
    "polygon", "matic", "avalanche", "avax", "chainlink", "link",
    "cardano", "ada", "polkadot", "dot", "litecoin", "ltc",
})

def _is_crypto_market(question: str) -> bool:
    """Return True if the market question is about a crypto asset."""
    q = question.lower()
    return any(kw in q for kw in _CRYPTO_KEYWORDS)


# =============================================================================
# GAMMA API — MARKET DISCOVERY
# =============================================================================

GAMMA_BASE = "https://gamma-api.polymarket.com"


@dataclass
class MarketInfo:
    """Normalised Polymarket market record."""
    market_id: str
    question: str
    description: str
    yes_token_id: str
    yes_price: float        # current market YES price (0–1)
    volume_usd: float
    liquidity_usd: float
    end_date_iso: str
    tags: list[str]


def _parse_yes_price(market: dict[str, Any]) -> float:
    """Extract the YES price from a Gamma API market dict."""
    # outcomePrices is often '[\"0.55\",\"0.45\"]'
    raw = market.get("outcomePrices")
    if isinstance(raw, str):
        try:
            prices = json.loads(raw)
            return float(prices[0])
        except Exception:
            pass
    if isinstance(raw, list) and raw:
        try:
            return float(raw[0])
        except Exception:
            pass
    # Fallback: best_bid / best_ask midpoint
    bid = float(market.get("bestBid", 0) or 0)
    ask = float(market.get("bestAsk", 1) or 1)
    return (bid + ask) / 2.0


def _parse_yes_token_id(market: dict[str, Any]) -> str:
    """Extract the YES-side CLOB token ID from a market dict."""
    raw = market.get("clobTokenIds")
    if isinstance(raw, str):
        try:
            ids = json.loads(raw)
            if isinstance(ids, list) and ids:
                return str(ids[0])
        except Exception:
            pass
    if isinstance(raw, list) and raw:
        return str(raw[0])
    return ""


async def fetch_active_markets(
    cfg: OracleConfig,
    client: httpx.AsyncClient,
) -> list[MarketInfo]:
    """
    Pull active, non-expired, non-crypto markets from the Gamma API.

    Returns up to `cfg.markets_limit` markets sorted by 24-hour volume
    descending so the oracle works on the most liquid opportunities first.
    """
    params = {
        "active": "true",
        "closed": "false",
        "order": "volume24hr",
        "ascending": "false",
        "limit": cfg.markets_limit * 3,  # over-fetch so we have enough after filtering
        "offset": 0,
    }

    try:
        resp = await client.get(f"{GAMMA_BASE}/markets", params=params, timeout=15.0)
        resp.raise_for_status()
        raw_markets: list[dict] = resp.json()
    except Exception as exc:
        logger.error("gamma_api_fetch_failed", error=str(exc))
        return []

    results: list[MarketInfo] = []
    for m in raw_markets:
        question = m.get("question", "")
        if not question:
            continue
        if _is_crypto_market(question):
            continue

        yes_token_id = _parse_yes_token_id(m)
        if not yes_token_id:
            continue  # CLOB not set up → not tradeable

        yes_price = _parse_yes_price(m)
        # Skip markets that are effectively resolved (price at extremes)
        if yes_price <= 0.02 or yes_price >= 0.98:
            continue

        results.append(
            MarketInfo(
                market_id=str(m.get("id", "")),
                question=question,
                description=str(m.get("description", ""))[:800],  # truncate for LLM
                yes_token_id=yes_token_id,
                yes_price=yes_price,
                volume_usd=float(m.get("volume", 0) or 0),
                liquidity_usd=float(m.get("liquidity", 0) or 0),
                end_date_iso=str(m.get("endDate", "")),
                tags=[t.get("label", "") for t in (m.get("tags") or []) if isinstance(t, dict)],
            )
        )

        if len(results) >= cfg.markets_limit:
            break

    logger.info(
        "markets_fetched",
        total_raw=len(raw_markets),
        after_filter=len(results),
    )
    return results


# =============================================================================
# CONTEXT RETRIEVAL (mock — plug in real news API here)
# =============================================================================

async def fetch_real_time_context(
    query: str,
    cfg: OracleConfig,
    client: httpx.AsyncClient,
) -> str:
    """
    Retrieve real-time news / context for the given market question.

    Currently returns mock context so the pipeline works out-of-the-box.

    ── TO CONNECT A REAL NEWS SOURCE ──────────────────────────────────────────
    Option A — NewsAPI (https://newsapi.org):
        if cfg.newsapi_key:
            r = await client.get(
                "https://newsapi.org/v2/everything",
                params={"q": query, "pageSize": 5, "sortBy": "publishedAt",
                        "apiKey": cfg.newsapi_key},
                timeout=10.0,
            )
            articles = r.json().get("articles", [])
            return "\n".join(
                f"• {a['title']} — {a['source']['name']} ({a['publishedAt'][:10]})"
                for a in articles
            )

    Option B — Perplexity Sonar API:
        if cfg.perplexity_api_key:
            r = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={"Authorization": f"Bearer {cfg.perplexity_api_key}"},
                json={"model": "sonar", "messages": [
                    {"role": "user", "content": f"Latest news on: {query}"}
                ]},
                timeout=15.0,
            )
            return r.json()["choices"][0]["message"]["content"]

    Option C — Google News RSS via feedparser (already in requirements):
        import feedparser
        feed = feedparser.parse(
            f"https://news.google.com/rss/search?q={query.replace(' ', '+')}&hl=en"
        )
        return "\n".join(f"• {e.title} ({e.published})" for e in feed.entries[:5])
    ─────────────────────────────────────────────────────────────────────────────
    """
    # ── Live context: NewsAPI ─────────────────────────────────────────────────
    if cfg.newsapi_key:
        try:
            r = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "pageSize": 5,
                    "sortBy": "publishedAt",
                    "language": "en",
                    "apiKey": cfg.newsapi_key,
                },
                timeout=10.0,
            )
            articles = r.json().get("articles", [])
            if articles:
                lines = [
                    f"• {a['title']} — {a.get('source', {}).get('name', 'Unknown')} "
                    f"({str(a.get('publishedAt', ''))[:10]})"
                    for a in articles
                ]
                return "Recent headlines:\n" + "\n".join(lines)
        except Exception as exc:
            logger.warning("newsapi_fetch_failed", error=str(exc))

    # ── Fallback: mock context ────────────────────────────────────────────────
    # Replace this block when a real news source is wired up.
    return (
        "[MOCK CONTEXT — replace fetch_real_time_context() with a real news call]\n"
        f"Query: {query}\n"
        "No live news data available in this configuration. "
        "The LLM will rely on its training knowledge only. "
        "Confidence scores are expected to be lower without real-time context."
    )


# =============================================================================
# LLM PROBABILITY EVALUATION
# =============================================================================

_SYSTEM_PROMPT = """\
You are a ruthless quantitative analyst working for a proprietary prediction market trading firm.

Your job is to evaluate Polymarket binary questions and produce calibrated probability estimates.

Rules:
- Read the market question, the official resolution rules, and the provided news context carefully.
- Think like a Bayesian reasoner: start with a base rate, then update on the evidence.
- Be brutally honest. Ignore hype. Favour base rates over narrative.
- Your output MUST be a single JSON object with exactly these three fields:
  {
    "probability": <float between 0.0 and 1.0, your P(YES)>,
    "confidence":  <float between 0.0 and 1.0, how confident you are in your estimate>,
    "reasoning":   "<one concise paragraph explaining your logic>"
  }
- Do NOT output anything outside the JSON object. No markdown, no preamble, no suffix.
"""


@dataclass
class LLMEvaluation:
    """Output from the LLM probability evaluator."""
    probability: float   # P(YES) as 0–1
    confidence: float    # Self-reported confidence as 0–1
    reasoning: str       # LLM's explanation


async def evaluate_probability(
    market: MarketInfo,
    context: str,
    cfg: OracleConfig,
    http_client: httpx.AsyncClient,
) -> Optional[LLMEvaluation]:
    """
    Ask the configured LLM to evaluate P(YES) for a market.

    Tries Anthropic Claude first (preferred); falls back to OpenAI GPT-4o.
    Returns None on total failure.
    """
    user_content = (
        f"MARKET QUESTION:\n{market.question}\n\n"
        f"RESOLUTION RULES:\n{market.description or 'Standard binary market rules apply.'}\n\n"
        f"MARKET CLOSES: {market.end_date_iso}\n\n"
        f"CURRENT MARKET YES PRICE: {market.yes_price:.3f} "
        f"(the crowd's implied probability)\n\n"
        f"REAL-TIME CONTEXT:\n{context}\n\n"
        "Evaluate the TRUE probability that this market resolves YES. "
        "Output only the JSON object described in your instructions."
    )

    raw_text: Optional[str] = None

    # ── Primary: Anthropic Claude ─────────────────────────────────────────────
    if cfg.anthropic_api_key and _ANTHROPIC_AVAILABLE:
        raw_text = await _call_anthropic(
            cfg.anthropic_api_key,
            cfg.llm_model,
            user_content,
            http_client,
        )

    # ── Fallback: OpenAI ──────────────────────────────────────────────────────
    if raw_text is None and cfg.openai_api_key:
        raw_text = await _call_openai(
            cfg.openai_api_key,
            user_content,
            http_client,
        )

    if raw_text is None:
        logger.error("llm_eval_failed_no_response", question=market.question[:80])
        return None

    return _parse_llm_json(raw_text, market.question)


async def _call_anthropic(
    api_key: str,
    model: str,
    user_content: str,
    http_client: httpx.AsyncClient,
) -> Optional[str]:
    """POST to the Anthropic Messages API via httpx (consistent with backend style)."""
    # Resolve model: map legacy names to current IDs
    resolved_model = _resolve_anthropic_model(model)

    payload = {
        "model": resolved_model,
        "max_tokens": 512,
        "system": _SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_content}],
    }

    try:
        resp = await http_client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]
    except httpx.HTTPStatusError as exc:
        logger.error(
            "anthropic_http_error",
            status=exc.response.status_code,
            body=exc.response.text[:200],
        )
    except Exception as exc:
        logger.error("anthropic_call_failed", error=str(exc))

    return None


def _resolve_anthropic_model(model: str) -> str:
    """Map config model strings to valid Anthropic API model IDs."""
    _aliases = {
        "claude-sonnet-4-5":          "claude-sonnet-4-5",
        "claude-sonnet-4-20250514":   "claude-sonnet-4-5",
        "claude-3-5-sonnet":          "claude-3-5-sonnet-20241022",
        "claude-3-5-sonnet-20241022": "claude-3-5-sonnet-20241022",
        "claude-3-haiku":             "claude-3-haiku-20240307",
        "claude-3-opus":              "claude-3-opus-20240229",
    }
    return _aliases.get(model, model)


async def _call_openai(
    api_key: str,
    user_content: str,
    http_client: httpx.AsyncClient,
) -> Optional[str]:
    """POST to the OpenAI Chat Completions API via httpx."""
    payload = {
        "model": "gpt-4o",
        "max_tokens": 512,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": user_content},
        ],
        "response_format": {"type": "json_object"},
    }

    try:
        resp = await http_client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "content-type": "application/json",
            },
            json=payload,
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as exc:
        logger.error(
            "openai_http_error",
            status=exc.response.status_code,
            body=exc.response.text[:200],
        )
    except Exception as exc:
        logger.error("openai_call_failed", error=str(exc))

    return None


def _parse_llm_json(raw: str, question: str) -> Optional[LLMEvaluation]:
    """Extract and validate the JSON block from the LLM response."""
    # Strip markdown code fences if present
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(l for l in lines if not l.startswith("```")).strip()

    # Find the first complete JSON object in the response
    start = text.find("{")
    end   = text.rfind("}") + 1
    if start == -1 or end == 0:
        logger.warning("llm_no_json_found", question=question[:80], raw=raw[:200])
        return None

    try:
        parsed = json.loads(text[start:end])
    except json.JSONDecodeError as exc:
        logger.warning("llm_json_parse_error", error=str(exc), raw=text[start:end][:200])
        return None

    prob = parsed.get("probability")
    conf = parsed.get("confidence")
    reasoning = str(parsed.get("reasoning", ""))

    if prob is None or conf is None:
        logger.warning("llm_json_missing_fields", parsed=parsed)
        return None

    try:
        prob = float(prob)
        conf = float(conf)
    except (TypeError, ValueError):
        logger.warning("llm_json_bad_types", prob=prob, conf=conf)
        return None

    if not (0.0 <= prob <= 1.0) or not (0.0 <= conf <= 1.0):
        logger.warning("llm_json_out_of_range", prob=prob, conf=conf)
        return None

    return LLMEvaluation(probability=prob, confidence=conf, reasoning=reasoning)


# =============================================================================
# POSITION SIZING — simplified Kelly
# =============================================================================

def kelly_position_usdc(
    prob: float,
    market_price: float,
    bankroll_usdc: float,
    cap_fraction: float,
) -> float:
    """
    Classic Kelly for a binary bet.

    b  = net odds per $ risked = (1 - market_price) / market_price
    f* = (b*p - q) / b     where p = LLM probability, q = 1-p

    The result is capped at `cap_fraction` of bankroll.
    """
    if market_price <= 0.0 or market_price >= 1.0:
        return 0.0
    b = (1.0 - market_price) / market_price
    p = prob
    q = 1.0 - p
    raw_f = (b * p - q) / b
    if raw_f <= 0.0:
        return 0.0
    capped_f = min(raw_f, cap_fraction)
    return bankroll_usdc * capped_f


# =============================================================================
# ORACLE — main class
# =============================================================================

class Oracle:
    """
    The AI Prediction Oracle.

    Instantiate once, call `await oracle.run_cycle()` to process one batch
    of markets, or `await oracle.run_forever()` for the production loop.
    """

    def __init__(self, cfg: OracleConfig) -> None:
        self.cfg = cfg
        self._http: Optional[httpx.AsyncClient] = None
        self._executor: Optional[TradeExecutor] = None
        self._cycle_count = 0

        mode = "DRY-RUN" if cfg.dry_run else "LIVE"
        logger.info(
            "oracle_init",
            mode=mode,
            model=cfg.llm_model,
            min_edge=cfg.min_edge,
            min_confidence=cfg.min_confidence,
            max_position_usdc=cfg.max_position_usdc,
        )

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def __aenter__(self) -> "Oracle":
        self._http = httpx.AsyncClient(
            headers={"User-Agent": "BlackEdgeOracle/1.0"},
            follow_redirects=True,
        )
        self._executor = TradeExecutor(
            private_key=self.cfg.private_key,
            test_mode=self.cfg.dry_run,
        )
        if not self.cfg.dry_run:
            await self._executor.initialize()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._http:
            await self._http.aclose()

    # ── Public API ────────────────────────────────────────────────────────────

    async def run_cycle(self) -> int:
        """
        Execute one full scan-evaluate-execute cycle.

        Returns the number of trades fired (0 in dry-run just means simulated).
        """
        self._cycle_count += 1
        logger.info("cycle_start", cycle=self._cycle_count)
        t0 = time.monotonic()

        markets = await fetch_active_markets(self.cfg, self._http)
        if not markets:
            logger.warning("no_markets_found")
            return 0

        # Evaluate markets concurrently (rate-limit: max 5 in-flight at once)
        semaphore = asyncio.Semaphore(5)
        tasks = [self._process_market(m, semaphore) for m in markets]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        trades_fired = sum(1 for r in results if r is True)
        elapsed = time.monotonic() - t0
        logger.info(
            "cycle_complete",
            cycle=self._cycle_count,
            markets_evaluated=len(markets),
            trades_fired=trades_fired,
            elapsed_secs=round(elapsed, 2),
        )
        return trades_fired

    async def run_forever(self) -> None:
        """Run scan cycles every `cfg.loop_interval_secs` seconds."""
        logger.info("oracle_starting", interval_secs=self.cfg.loop_interval_secs)
        while True:
            try:
                await self.run_cycle()
            except Exception as exc:
                logger.error("cycle_unhandled_error", error=str(exc), exc_info=True)

            logger.info(
                "sleeping",
                secs=self.cfg.loop_interval_secs,
                next_cycle_in=f"{self.cfg.loop_interval_secs}s",
            )
            await asyncio.sleep(self.cfg.loop_interval_secs)

    # ── Internal ──────────────────────────────────────────────────────────────

    async def _process_market(
        self,
        market: MarketInfo,
        semaphore: asyncio.Semaphore,
    ) -> bool:
        """
        Evaluate a single market and optionally execute.

        Returns True if a trade was (or would have been) fired.
        """
        async with semaphore:
            # Step 1: fetch context
            context = await fetch_real_time_context(
                market.question, self.cfg, self._http
            )

            # Step 2: LLM evaluation
            evaluation = await evaluate_probability(
                market, context, self.cfg, self._http
            )
            if evaluation is None:
                return False

            edge = evaluation.probability - market.yes_price

            logger.info(
                "market_evaluated",
                question=market.question[:80],
                yes_price=round(market.yes_price, 3),
                llm_prob=round(evaluation.probability, 3),
                edge=round(edge, 3),
                confidence=round(evaluation.confidence, 3),
                reasoning=evaluation.reasoning[:120],
            )

            # Step 3: edge + confidence gate
            if edge < self.cfg.min_edge:
                logger.debug("edge_insufficient", edge=round(edge, 3), required=self.cfg.min_edge)
                return False

            if evaluation.confidence < self.cfg.min_confidence:
                logger.debug(
                    "confidence_insufficient",
                    confidence=round(evaluation.confidence, 3),
                    required=self.cfg.min_confidence,
                )
                return False

            # Step 4: size the position
            # Bankroll: in dry-run we use a notional $1 000; in live mode we
            # would read the actual USDC balance from the wallet.
            bankroll = 1_000.0 if self.cfg.dry_run else await self._get_balance()
            position_usdc = kelly_position_usdc(
                prob=evaluation.probability,
                market_price=market.yes_price,
                bankroll_usdc=bankroll,
                cap_fraction=self.cfg.bankroll_fraction,
            )
            position_usdc = min(position_usdc, self.cfg.max_position_usdc)

            if position_usdc < 5.0:
                logger.info("position_too_small", position_usdc=round(position_usdc, 2))
                return False

            # Step 5: execute (or simulate)
            return await self._execute_buy(market, evaluation, position_usdc)

    async def _execute_buy(
        self,
        market: MarketInfo,
        evaluation: LLMEvaluation,
        position_usdc: float,
    ) -> bool:
        """Place a BUY order via TradeExecutor (or simulate in dry-run)."""
        logger.info(
            "TRADE_SIGNAL",
            action="BUY",
            market_id=market.market_id,
            question=market.question[:100],
            yes_token_id=market.yes_token_id[:20] + "...",
            yes_price=round(market.yes_price, 4),
            llm_probability=round(evaluation.probability, 4),
            edge=round(evaluation.probability - market.yes_price, 4),
            confidence=round(evaluation.confidence, 4),
            position_usdc=round(position_usdc, 2),
            dry_run=self.cfg.dry_run,
            reasoning=evaluation.reasoning,
        )

        if not self._executor:
            logger.error("executor_not_initialized")
            return False

        try:
            order_id = await self._executor.market_buy(
                token_id=market.yes_token_id,
                amount_usdc=position_usdc,
            )
            if order_id:
                logger.info(
                    "trade_executed",
                    order_id=order_id,
                    market_id=market.market_id,
                    usdc=round(position_usdc, 2),
                )
                return True
            else:
                logger.warning("trade_rejected_by_executor", market_id=market.market_id)
                return False
        except Exception as exc:
            logger.error("trade_execution_error", error=str(exc), market_id=market.market_id)
            return False

    async def _get_balance(self) -> float:
        """Read live USDC balance from the executor wallet."""
        if self._executor and self._executor.initialized:
            try:
                balance = await self._executor.get_usdc_balance()
                return float(balance or 0.0)
            except Exception:
                pass
        return 1_000.0  # safe fallback


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

async def _async_main(run_once: bool) -> None:
    cfg = OracleConfig()

    try:
        cfg.validate()
    except EnvironmentError as exc:
        logger.error("config_validation_failed", error=str(exc))
        sys.exit(1)

    async with Oracle(cfg) as oracle:
        if run_once:
            await oracle.run_cycle()
        else:
            await oracle.run_forever()


def main() -> None:
    """Entry point: `python oracle.py [--once]`"""
    import structlog
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.dev.ConsoleRenderer(colors=True),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )

    parser = argparse.ArgumentParser(
        description="Black Edge Oracle — AI Prediction Pipeline"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single scan cycle and exit (useful for cron / Railway cron)",
    )
    args = parser.parse_args()

    asyncio.run(_async_main(run_once=args.once))


if __name__ == "__main__":
    main()
