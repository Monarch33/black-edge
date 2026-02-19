"""
AI Council — Multi-LLM failover
================================
Gemini 1.5 Flash  → Scanner (50 markets, cheap & fast)
GPT-4o            → Analyst (top 3 markets, deep reasoning)
Failover:
  - Gemini quota  → OpenAI does the scan
  - OpenAI fails  → Gemini Pro does the analysis
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx
import structlog

logger = structlog.get_logger()

# ── Endpoints ────────────────────────────────────────────────────────────────
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"

# ── Rate-limit pauses ─────────────────────────────────────────────────────────
_gemini_paused_until: float = 0.0
_openai_paused_until: float = 0.0

# ── In-memory cache ───────────────────────────────────────────────────────────
_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 300  # 5 minutes


# =============================================================================
# Dataclasses
# =============================================================================

@dataclass
class MarketSummary:
    """Lightweight market data for scanner."""
    market_id: str
    question: str
    description: str
    yes_price: float
    volume24hr: float
    liquidity: float


@dataclass
class AlphaCandidate:
    """Market flagged by scanner as potential alpha."""
    market: MarketSummary
    scanner_confidence: float
    scanner_reasoning: str


@dataclass
class CouncilDecision:
    """Final decision from the Analyst."""
    market_id: str
    question: str
    ia_probability: float
    confidence: float
    recommended_side: str  # YES | NO
    market_price: float
    edge_pct: float
    reasoning: str
    scanner_model: str = "gemini-1.5-flash"
    analyst_model: str = "gpt-4o"


# =============================================================================
# Cache helpers
# =============================================================================

def _cache_key(market_id: str, role: str) -> str:
    return f"be:{role}:{hashlib.md5(market_id.encode()).hexdigest()}"


def _cache_get(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if entry and (time.time() - entry[0]) < CACHE_TTL:
        return entry[1]
    _cache.pop(key, None)
    return None


def _cache_set(key: str, value: Any) -> None:
    _cache[key] = (time.time(), value)


def _try_redis_get(key: str) -> Optional[str]:
    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url:
        return None
    try:
        import redis as redis_lib
        r = redis_lib.Redis.from_url(redis_url, decode_responses=True, socket_timeout=2)
        return r.get(key)
    except Exception:
        return None


def _try_redis_set(key: str, value: str) -> None:
    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url:
        return
    try:
        import redis as redis_lib
        r = redis_lib.Redis.from_url(redis_url, decode_responses=True, socket_timeout=2)
        r.setex(key, CACHE_TTL, value)
    except Exception:
        pass


# =============================================================================
# Gemini helpers
# =============================================================================

def _gemini_available() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY", "").strip()) and time.time() >= _gemini_paused_until


def _openai_available() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY", "").strip()) and time.time() >= _openai_paused_until


async def _call_gemini(model: str, prompt: str, max_tokens: int = 512) -> Optional[str]:
    """Low-level Gemini call. Returns raw text or None on failure."""
    global _gemini_paused_until

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    url = GEMINI_URL.format(model=model)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.1},
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(f"{url}?key={api_key}", json=payload)
            if resp.status_code == 429:
                _gemini_paused_until = time.time() + 60
                logger.warning("Gemini rate limited — pausing 60s")
                return None
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        logger.warning("Gemini call failed", model=model, error=str(e)[:80])
        return None


async def _call_openai(model: str, system: str, user: str, max_tokens: int = 400) -> Optional[str]:
    """Low-level OpenAI call. Returns raw text or None on failure."""
    global _openai_paused_until

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.1,
                    "max_tokens": max_tokens,
                    "response_format": {"type": "json_object"},
                },
            )
            if resp.status_code == 429:
                _openai_paused_until = time.time() + 60
                logger.warning("OpenAI rate limited — pausing 60s")
                return None
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.warning("OpenAI call failed", model=model, error=str(e)[:80])
        return None


def _parse_json_safe(text: str) -> Optional[dict]:
    """Parse JSON, stripping markdown fences if present."""
    if not text:
        return None
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        return json.loads(text)
    except Exception:
        return None


# =============================================================================
# SCANNER — Gemini 1.5 Flash (with OpenAI fallback)
# =============================================================================

_SCANNER_SYSTEM = """You are a prediction market scanner. Given a list of markets, identify which ones have the highest probability of being mispriced (alpha potential).

Respond ONLY with valid JSON:
{"candidates": [{"market_id": "...", "confidence": 0.0-1.0, "reasoning": "one sentence"}]}

Include at most 3 candidates. confidence > 0.6 means strong alpha potential."""


async def scan_for_alpha(markets: list[MarketSummary]) -> list[AlphaCandidate]:
    """
    Phase 1: Scan markets for alpha candidates.
    Gemini Flash first (cheap), OpenAI fallback on quota/failure.
    """
    if not markets:
        return []

    markets_text = "\n".join(
        f"- ID: {m.market_id[:16]} | Q: {m.question[:80]} | YES: {m.yes_price:.3f} | VOL: ${m.volume24hr:,.0f}"
        for m in markets[:50]
    )
    prompt = f"Analyze these prediction markets for mispricing alpha:\n{markets_text}"

    raw: Optional[str] = None
    scanner_model = "gemini-1.5-flash"

    if _gemini_available():
        raw = await _call_gemini("gemini-1.5-flash", _SCANNER_SYSTEM + "\n\n" + prompt, max_tokens=600)

    if raw is None and _openai_available():
        logger.info("Scanner: Gemini unavailable — using OpenAI fallback")
        scanner_model = "gpt-4o-mini"
        raw = await _call_openai("gpt-4o-mini", _SCANNER_SYSTEM, prompt, max_tokens=500)

    if not raw:
        logger.warning("Scanner: all LLMs unavailable")
        return []

    parsed = _parse_json_safe(raw)
    if not parsed or "candidates" not in parsed:
        return []

    candidates: list[AlphaCandidate] = []
    market_map = {m.market_id: m for m in markets}

    for c in parsed["candidates"][:3]:
        mid = c.get("market_id", "")
        market = market_map.get(mid) or next(
            (m for m in markets if mid in m.market_id), None
        )
        if not market:
            continue
        candidates.append(AlphaCandidate(
            market=market,
            scanner_confidence=float(c.get("confidence", 0.5)),
            scanner_reasoning=str(c.get("reasoning", ""))[:200],
        ))
        logger.info(
            "[ALPHA] Candidate detected",
            market_id=mid[:16],
            confidence=c.get("confidence"),
            model=scanner_model,
        )

    return candidates


# =============================================================================
# ANALYST — GPT-4o (with Gemini Pro fallback)
# =============================================================================

_ANALYST_SYSTEM = """You are an elite prediction market analyst. Evaluate whether this market's current price is mispriced.

Respond ONLY with valid JSON (no markdown):
{"probability": 0.0-1.0, "confidence": 0.0-1.0, "reasoning": "paragraph"}

"probability" = your estimated true probability the event resolves YES.
"confidence" = certainty in your estimate. Be conservative (0.4-0.7 typical range).
Only output JSON, nothing else."""


async def analyze_candidate(candidate: AlphaCandidate) -> Optional[CouncilDecision]:
    """
    Phase 2: Deep analysis of a single candidate.
    GPT-4o first, Gemini Pro fallback.
    """
    m = candidate.market

    # Check cache
    ck = _cache_key(m.market_id, "analyst")
    cached_str = _try_redis_get(ck) or (str(_cache_get(ck)) if _cache_get(ck) else None)
    if cached_str and cached_str != "None":
        try:
            result = json.loads(cached_str) if isinstance(cached_str, str) else cached_str
            return _build_decision(m, result, "gpt-4o (cached)", "gpt-4o (cached)")
        except Exception:
            pass

    user_prompt = (
        f"Market: {m.question}\n"
        f"Description: {m.description[:400]}\n"
        f"Current YES price: {m.yes_price:.3f} (market implies {m.yes_price*100:.1f}%)\n"
        f"24h Volume: ${m.volume24hr:,.0f} | Liquidity: ${m.liquidity:,.0f}\n"
        f"Scanner note: {candidate.scanner_reasoning}"
    )

    raw: Optional[str] = None
    analyst_model = "gpt-4o"

    if _openai_available():
        raw = await _call_openai("gpt-4o", _ANALYST_SYSTEM, user_prompt, max_tokens=400)

    if raw is None and _gemini_available():
        logger.info("Analyst: OpenAI unavailable — using Gemini Pro fallback")
        analyst_model = "gemini-1.5-pro"
        raw = await _call_gemini(
            "gemini-1.5-pro",
            _ANALYST_SYSTEM + "\n\n" + user_prompt,
            max_tokens=400,
        )

    if not raw:
        logger.warning("Analyst: all LLMs unavailable")
        return None

    parsed = _parse_json_safe(raw)
    if not parsed:
        logger.warning("Analyst: invalid JSON response", model=analyst_model)
        return None

    # Cache result
    try:
        encoded = json.dumps(parsed)
        _cache_set(ck, parsed)
        _try_redis_set(ck, encoded)
    except Exception:
        pass

    decision = _build_decision(m, parsed, candidate.scanner_model, analyst_model)
    if decision:
        logger.info(
            "[DECISION] Council verdict",
            market_id=m.market_id[:16],
            edge=decision.edge_pct,
            side=decision.recommended_side,
            confidence=decision.confidence,
        )
    return decision


def _build_decision(
    m: MarketSummary,
    result: dict,
    scanner_model: str,
    analyst_model: str,
) -> Optional[CouncilDecision]:
    """Build CouncilDecision from parsed LLM JSON."""
    try:
        ia_prob = max(0.01, min(0.99, float(result["probability"])))
        confidence = max(0.0, min(1.0, float(result.get("confidence", 0.5))))
        reasoning = str(result.get("reasoning", ""))[:300]
    except (KeyError, ValueError, TypeError):
        return None

    side = "YES" if ia_prob > m.yes_price else "NO"
    edge = round(abs(ia_prob - m.yes_price) * 100, 1)

    if edge < 5.0 or confidence < 0.4:
        return None

    return CouncilDecision(
        market_id=m.market_id,
        question=m.question,
        ia_probability=ia_prob,
        confidence=confidence,
        recommended_side=side,
        market_price=m.yes_price,
        edge_pct=edge,
        reasoning=reasoning,
        scanner_model=scanner_model,
        analyst_model=analyst_model,
    )
