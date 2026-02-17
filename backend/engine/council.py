"""
Council AI — 5 agents analyze each market and vote.
This is the CORE of Black Edge. Without this, we have no product.
"""

import asyncio
import time
import structlog
from dataclasses import dataclass
from typing import Optional

logger = structlog.get_logger()


@dataclass
class AgentVote:
    agent_name: str
    signal: str  # "BUY", "HOLD", "SELL"
    confidence: float  # 0.0 to 1.0
    reasoning: str


@dataclass
class CouncilDecision:
    market_id: str
    market_question: str
    timestamp: float
    agent_votes: list
    final_signal: str  # "STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL", "AVOID"
    final_confidence: float
    consensus_pct: float
    edge: float
    doomer_veto: bool
    summary: str


class CouncilAI:
    """
    5-agent Council that analyzes Polymarket markets.
    Each agent uses different data to form an opinion.
    The Judge aggregates the votes.
    """

    def __init__(self):
        self._cache: dict[str, CouncilDecision] = {}
        self._cache_ttl = 300  # 5 min cache per market

    async def analyze_market(self, market: dict) -> CouncilDecision:
        market_id = market.get("conditionId", market.get("id", ""))
        question = market.get("question", "")

        # Check cache
        if market_id in self._cache:
            cached = self._cache[market_id]
            if time.time() - cached.timestamp < self._cache_ttl:
                return cached

        yes_price = float(market.get("yesPrice", 0) or 0)
        volume = float(market.get("volume", 0) or 0)
        volume24hr = float(market.get("volume24hr", 0) or 0)
        liquidity = float(market.get("liquidity", 0) or 0)

        votes = await asyncio.gather(
            self._fundamentals_agent(market_id, question, yes_price, volume, volume24hr, liquidity),
            self._sentiment_agent(market_id, question, yes_price),
            self._sniper_agent(market_id, question, yes_price, volume24hr, liquidity),
            self._narrative_agent(market_id, question, yes_price),
            self._doomer_agent(market_id, question, yes_price, volume, liquidity),
        )

        decision = self._judge(market_id, question, yes_price, list(votes))
        self._cache[market_id] = decision

        logger.info(
            "Council decision",
            market=question[:50],
            signal=decision.final_signal,
            edge=f"{decision.edge:+.1f}%",
            consensus=f"{decision.consensus_pct:.0f}%",
            doomer_veto=decision.doomer_veto,
        )

        return decision

    async def _fundamentals_agent(
        self, market_id: str, question: str,
        yes_price: float, volume: float, volume24hr: float, liquidity: float
    ) -> AgentVote:
        confidence = 0.5
        signal = "HOLD"
        reasoning = ""

        vol_score = min(volume24hr / 50000, 1.0)
        liq_score = min(liquidity / 100000, 1.0)

        if yes_price > 0.90:
            signal = "SELL"
            confidence = 0.4 + vol_score * 0.2
            reasoning = f"Price at {yes_price:.0%} is extreme. Mean reversion likely."
        elif yes_price < 0.10:
            signal = "BUY"
            confidence = 0.4 + vol_score * 0.2
            reasoning = f"Price at {yes_price:.0%} is very low. Potential upside if catalyst."
        elif yes_price > 0.65 and vol_score > 0.5:
            signal = "BUY"
            confidence = 0.5 + liq_score * 0.2
            reasoning = f"Strong consensus ({yes_price:.0%}) with high volume. Trend following."
        elif yes_price < 0.35 and vol_score > 0.5:
            signal = "SELL"
            confidence = 0.5 + liq_score * 0.2
            reasoning = f"Market says NO ({1-yes_price:.0%}). Volume confirms."
        else:
            signal = "HOLD"
            confidence = 0.3
            reasoning = f"Toss-up market ({yes_price:.0%}). No clear fundamental edge."

        if liquidity < 10000:
            confidence *= 0.6
            reasoning += " LOW LIQUIDITY WARNING."

        return AgentVote("Fundamentals", signal, round(min(confidence, 1.0), 2), reasoning)

    async def _sentiment_agent(self, market_id: str, question: str, yes_price: float) -> AgentVote:
        try:
            from engine.news_collector import NewsCollector
            collector = NewsCollector()
            headlines = await collector.search_headlines(question, limit=5)

            if headlines:
                pos_words = ['bullish', 'surge', 'rally', 'gain', 'positive', 'win', 'pass', 'approve', 'likely', 'confirmed']
                neg_words = ['bearish', 'crash', 'drop', 'fall', 'negative', 'lose', 'fail', 'reject', 'unlikely', 'denied']

                text = ' '.join(h.get('title', '') for h in headlines).lower()
                pos_count = sum(1 for w in pos_words if w in text)
                neg_count = sum(1 for w in neg_words if w in text)

                if pos_count > neg_count + 1:
                    return AgentVote("Sentiment", "BUY", 0.6, f"News positive ({pos_count} pos vs {neg_count} neg).")
                elif neg_count > pos_count + 1:
                    return AgentVote("Sentiment", "SELL", 0.6, f"News negative ({neg_count} neg vs {pos_count} pos).")
                else:
                    return AgentVote("Sentiment", "HOLD", 0.4, f"News mixed ({pos_count} pos, {neg_count} neg).")
        except Exception:
            pass

        return AgentVote("Sentiment", "HOLD", 0.3, "No news signal detected. Neutral.")

    async def _sniper_agent(
        self, market_id: str, question: str,
        yes_price: float, volume24hr: float, liquidity: float
    ) -> AgentVote:
        signal = "HOLD"
        confidence = 0.4
        reasoning = ""

        vol_liq_ratio = (volume24hr / liquidity) if liquidity > 0 else 0

        if vol_liq_ratio > 2.0:
            if yes_price > 0.5:
                signal = "BUY"
                confidence = 0.65
                reasoning = f"Volume spike ({vol_liq_ratio:.1f}x liquidity). Momentum toward YES."
            else:
                signal = "SELL"
                confidence = 0.65
                reasoning = f"Volume spike ({vol_liq_ratio:.1f}x liquidity). Momentum toward NO."
        elif vol_liq_ratio < 0.1:
            signal = "HOLD"
            confidence = 0.2
            reasoning = "Dead market. No volume."
        else:
            if 0.45 <= yes_price <= 0.55:
                signal = "HOLD"
                confidence = 0.3
                reasoning = "Price at 50/50. No microstructure edge."
            elif yes_price > 0.5:
                signal = "BUY"
                confidence = 0.45
                reasoning = f"Moderate momentum toward YES ({yes_price:.0%})."
            else:
                signal = "SELL"
                confidence = 0.45
                reasoning = f"Moderate momentum toward NO ({1-yes_price:.0%})."

        return AgentVote("Sniper", signal, round(confidence, 2), reasoning)

    async def _narrative_agent(self, market_id: str, question: str, yes_price: float) -> AgentVote:
        q = question.lower()
        hot_topics = ['trump', 'elon', 'musk', 'bitcoin', 'btc', 'fed', 'rate cut', 'ai', 'election', 'war', 'ukraine', 'russia', 'china', 'tariff']
        topic_match = [t for t in hot_topics if t in q]

        if topic_match:
            confidence = 0.55
            if yes_price > 0.6:
                signal = "BUY"
                reasoning = f"Hot narrative ({', '.join(topic_match)}). Strong consensus at {yes_price:.0%}."
            elif yes_price < 0.4:
                signal = "SELL"
                reasoning = f"Hot narrative ({', '.join(topic_match)}). Market says NO at {1-yes_price:.0%}."
            else:
                signal = "HOLD"
                reasoning = f"Hot narrative ({', '.join(topic_match)}) but market split."
        else:
            signal = "HOLD"
            confidence = 0.25
            reasoning = "Low narrative momentum. Not a trending topic."

        return AgentVote("Narrative", signal, round(0.55 if topic_match else 0.25, 2), reasoning)

    async def _doomer_agent(
        self, market_id: str, question: str,
        yes_price: float, volume: float, liquidity: float
    ) -> AgentVote:
        risks = []
        risk_score = 0.0

        if liquidity < 5000:
            risks.append("CRITICAL: Liquidity below $5K. Impossible to exit.")
            risk_score += 0.4
        elif liquidity < 20000:
            risks.append(f"Low liquidity (${liquidity/1000:.0f}K). Slippage risk.")
            risk_score += 0.2

        if yes_price > 0.95 or yes_price < 0.05:
            risks.append(f"Price at extreme ({yes_price*100:.0f}%). Minimal upside, high downside risk.")
            risk_score += 0.3

        if volume < 10000:
            risks.append("Total volume below $10K. Dead market.")
            risk_score += 0.2

        ambiguous_words = ['might', 'could', 'possibly', 'rumor', 'alleged']
        if any(w in question.lower() for w in ambiguous_words):
            risks.append("Ambiguous resolution language.")
            risk_score += 0.15

        if risk_score >= 0.5:
            signal = "SELL"
            confidence = min(0.5 + risk_score * 0.3, 0.95)
            reasoning = "VETO: " + " | ".join(risks[:3])
        elif risk_score >= 0.2:
            signal = "HOLD"
            confidence = 0.5
            reasoning = "Caution: " + " | ".join(risks[:2])
        else:
            signal = "HOLD"
            confidence = 0.3
            reasoning = "No major risks detected."

        return AgentVote("Doomer", signal, round(confidence, 2), reasoning)

    def _judge(
        self, market_id: str, question: str,
        yes_price: float, votes: list
    ) -> CouncilDecision:
        doomer_vote = next((v for v in votes if v.agent_name == "Doomer"), None)
        doomer_veto = bool(doomer_vote and doomer_vote.signal == "SELL" and doomer_vote.confidence >= 0.6)

        if doomer_veto:
            return CouncilDecision(
                market_id=market_id,
                market_question=question,
                timestamp=time.time(),
                agent_votes=votes,
                final_signal="AVOID",
                final_confidence=doomer_vote.confidence,
                consensus_pct=0,
                edge=0,
                doomer_veto=True,
                summary=f"DOOMER VETO: {doomer_vote.reasoning}",
            )

        weights = {"Fundamentals": 0.30, "Sentiment": 0.20, "Sniper": 0.20, "Narrative": 0.15, "Doomer": 0.15}
        score = 0.0
        total_confidence = 0.0

        for vote in votes:
            w = weights.get(vote.agent_name, 0.2)
            if vote.signal == "BUY":
                score += w * vote.confidence
            elif vote.signal == "SELL":
                score -= w * vote.confidence
            total_confidence += vote.confidence * w

        if score > 0.3:
            final_signal = "STRONG_BUY" if score > 0.5 else "BUY"
        elif score < -0.3:
            final_signal = "STRONG_SELL" if score < -0.5 else "SELL"
        else:
            final_signal = "HOLD"

        majority_direction = "BUY" if score > 0 else "SELL" if score < 0 else "HOLD"
        agreeing = sum(1 for v in votes if v.signal == majority_direction)
        consensus_pct = (agreeing / len(votes)) * 100 if votes else 0

        model_yes = 0.5 + score * 0.3
        edge = (model_yes - yes_price) * 100

        buy_count = sum(1 for v in votes if v.signal == "BUY")
        sell_count = sum(1 for v in votes if v.signal == "SELL")
        hold_count = sum(1 for v in votes if v.signal == "HOLD")
        summary = f"Council: {buy_count} BUY, {sell_count} SELL, {hold_count} HOLD → {final_signal}"

        return CouncilDecision(
            market_id=market_id,
            market_question=question,
            timestamp=time.time(),
            agent_votes=votes,
            final_signal=final_signal,
            final_confidence=round(total_confidence, 2),
            consensus_pct=round(consensus_pct, 1),
            edge=round(edge, 2),
            doomer_veto=False,
            summary=summary,
        )

    async def analyze_batch(self, markets: list, max_markets: int = 30) -> list:
        results = []
        for m in markets[:max_markets]:
            try:
                decision = await self.analyze_market(m)
                results.append(decision)
            except Exception as e:
                logger.warning("Council failed for market", error=str(e))
        return results

    def get_cached(self, market_id: str) -> Optional[CouncilDecision]:
        cached = self._cache.get(market_id)
        if cached and time.time() - cached.timestamp < self._cache_ttl:
            return cached
        return None

    def get_all_cached(self) -> dict:
        now = time.time()
        return {k: v for k, v in self._cache.items() if now - v.timestamp < self._cache_ttl}
