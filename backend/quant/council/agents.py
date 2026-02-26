"""
Multi-Agent Council - Democratic Decision-Making System

5 Specialized Agents + Judge + Orchestrator:
- SniperAgent: Microstructure specialist (mean-reversion scalper)
- NarrativeAgent: NLP & sentiment specialist
- WhaleHunterAgent: On-chain flow tracker
- DoomerAgent: Risk veto agent (highest weight)
- JudgeAgent: Final arbiter
- TheCouncil: Parallel execution orchestrator
"""

from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, List

import numpy as np

from ..config import (
    AgentRole, Conviction, TradeAction, AgentVote, CouncilDecision
)


# ═══════════════════════════════════════════════════════════════════════════
# WORLD STATE & SUB-STATES (27D Feature Vector for RL)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass(slots=True)
class MarketMicrostructure:
    """Microstructure features for the market."""
    order_book_imbalance: float      # [-1, 1] bid pressure
    volume_z_score: float            # Standard deviations
    momentum_1h: float               # [-0.5, 0.5]
    momentum_4h: float               # [-0.5, 0.5]
    momentum_24h: float              # [-0.5, 0.5]
    spread_bps: float                # Basis points
    liquidity_depth_usd: float       # Total depth
    price_reversion_score: float     # [-1, 1] mean-reversion tendency


@dataclass(slots=True)
class NarrativeState:
    """Narrative and sentiment state."""
    sentiment_score: float           # [-1, 1]
    nvi_score: float                 # [-1, 1]
    novelty_index: float             # [0, 1]
    credibility_factor: float        # [0, 1]
    sarcasm_probability: float       # [0, 1]
    tweet_volume_z: float            # Z-score
    narrative_coherence: float       # [0, 1]


@dataclass(slots=True)
class OnChainState:
    """On-chain flow and whale activity."""
    smart_money_flow: float          # [-1, 1]
    whale_concentration: float       # [0, 1]
    retail_flow: float               # [-1, 1]
    cross_platform_spread: float     # Basis points
    gas_congestion_pct: float        # [0, 100]


@dataclass(slots=True)
class PortfolioState:
    """Current portfolio risk state."""
    current_drawdown: float          # [0, 1]
    correlated_exposure: float       # [0, 1]
    leverage: float                  # [0, 1]
    sharpe_ratio: float              # Can be negative
    win_rate: float                  # [0, 1]
    time_to_resolution_hours: float  # Hours
    implied_volatility: float        # Annualized


@dataclass(slots=True)
class WorldState:
    """
    Complete state of the world for agent decision-making.

    Aggregates market microstructure, narrative, on-chain data,
    and portfolio state into a single coherent view.

    The 27-dimensional feature vector is used by the RL system
    for training the council's decision-making.
    """
    market_id: str
    timestamp_ms: int
    mid_price: float
    micro: MarketMicrostructure
    narrative: NarrativeState
    on_chain: OnChainState
    portfolio: PortfolioState

    def to_vector(self) -> np.ndarray:
        """
        Convert WorldState to 27-dimensional feature vector for RL.

        Returns:
            27D numpy array with all numerical features normalized
        """
        return np.array([
            # Basic (2)
            self.mid_price,
            self.timestamp_ms / 1e12,  # Normalize timestamp

            # Microstructure (8)
            self.micro.order_book_imbalance,
            self.micro.volume_z_score / 5.0,  # Normalize z-score
            self.micro.momentum_1h * 2.0,     # Expand range
            self.micro.momentum_4h * 2.0,
            self.micro.momentum_24h * 2.0,
            self.micro.spread_bps / 500.0,
            self.micro.liquidity_depth_usd / 100000.0,
            self.micro.price_reversion_score,

            # Narrative (7)
            self.narrative.sentiment_score,
            self.narrative.nvi_score,
            self.narrative.novelty_index,
            self.narrative.credibility_factor,
            self.narrative.sarcasm_probability,
            self.narrative.tweet_volume_z / 5.0,
            self.narrative.narrative_coherence,

            # On-chain (5)
            self.on_chain.smart_money_flow,
            self.on_chain.whale_concentration,
            self.on_chain.retail_flow,
            self.on_chain.cross_platform_spread / 1000.0,
            self.on_chain.gas_congestion_pct / 100.0,

            # Portfolio (5)
            self.portfolio.current_drawdown,
            self.portfolio.correlated_exposure,
            self.portfolio.leverage,
            self.portfolio.sharpe_ratio / 3.0,  # Normalize
            self.portfolio.win_rate,
        ], dtype=np.float32)


# ═══════════════════════════════════════════════════════════════════════════
# BASE AGENT (Abstract)
# ═══════════════════════════════════════════════════════════════════════════

class BaseAgent(ABC):
    """
    Abstract base class for all council agents.

    Each agent analyzes WorldState from its specialized perspective
    and casts a vote with conviction level.
    """

    __slots__ = ('role', 'weight', '_vote_count', '_error_count')

    def __init__(self, role: AgentRole, weight: float):
        self.role = role
        self.weight = weight
        self._vote_count = 0
        self._error_count = 0

    async def deliberate(self, state: WorldState) -> AgentVote:
        """
        Main entry point: analyze state and cast vote with timing.

        Args:
            state: Complete world state

        Returns:
            AgentVote with conviction, action, confidence, reasoning
        """
        start = time.perf_counter()

        try:
            vote = await self._analyze(state)
            self._vote_count += 1
        except Exception as e:
            self._error_count += 1
            vote = self._fallback_vote(str(e))

        latency_ms = int((time.perf_counter() - start) * 1000)
        vote.latency_ms = latency_ms

        return vote

    @abstractmethod
    async def _analyze(self, state: WorldState) -> AgentVote:
        """
        Analyze state and return vote. Must be implemented by subclass.

        Args:
            state: Complete world state

        Returns:
            AgentVote
        """
        pass

    def _fallback_vote(self, error: str) -> AgentVote:
        """
        Return safe fallback vote if agent crashes.

        Args:
            error: Error message

        Returns:
            ABSTAIN vote with HOLD action
        """
        return AgentVote(
            role=self.role,
            conviction=Conviction.ABSTAIN,
            action=TradeAction.HOLD,
            size_fraction=0.0,
            confidence=0.0,
            reasoning=f"⚠️ Agent error: {error[:50]}",
            latency_ms=0,
            dissent_flags=[f"ERROR: {error[:50]}"]
        )

    def __repr__(self) -> str:
        return (f"{self.role.value}Agent(weight={self.weight}, "
                f"votes={self._vote_count}, errors={self._error_count})")


# ═══════════════════════════════════════════════════════════════════════════
# AGENT 1: SNIPER (Microstructure Specialist)
# ═══════════════════════════════════════════════════════════════════════════

class SniperAgent(BaseAgent):
    """
    Fast mean-reversion scalper focused on microstructure.

    Analyzes:
    - Order book imbalance (buying/selling pressure)
    - Volume anomalies (Z-score spikes)
    - Momentum alignment across 3 timeframes
    - Market regime (mean-reversion vs. trend)

    Filters:
    - Spread < 300 bps
    - Liquidity depth > $5,000
    """

    def __init__(self):
        super().__init__(AgentRole.SNIPER, weight=1.2)

    async def _analyze(self, state: WorldState) -> AgentVote:
        m = state.micro

        # Liquidity filters (hard requirements)
        if m.spread_bps >= 300:
            return AgentVote(
                role=self.role,
                conviction=Conviction.ABSTAIN,
                action=TradeAction.HOLD,
                size_fraction=0.0,
                confidence=0.0,
                reasoning="🎯 Spread too wide (>300bps)",
                latency_ms=0,
                dissent_flags=["SPREAD_TOO_WIDE"]
            )

        if m.liquidity_depth_usd < 5000:
            return AgentVote(
                role=self.role,
                conviction=Conviction.ABSTAIN,
                action=TradeAction.HOLD,
                size_fraction=0.0,
                confidence=0.0,
                reasoning="🎯 Insufficient liquidity (<$5k)",
                latency_ms=0,
                dissent_flags=["LOW_LIQUIDITY"]
            )

        # Score components
        obi_signal = m.order_book_imbalance * 0.35
        vol_signal = np.tanh(m.volume_z_score / 3.0) * 0.25

        # Momentum alignment: all 3 timeframes agree?
        mom_signs = [np.sign(m.momentum_1h), np.sign(m.momentum_4h), np.sign(m.momentum_24h)]
        mom_alignment = (sum(mom_signs) / 3.0) * abs(m.momentum_1h) * 0.25

        # Regime: mean-reversion or trend?
        regime_signal = m.price_reversion_score * 0.15

        # Total score
        score = obi_signal + vol_signal + mom_alignment + regime_signal

        # Map to conviction
        if score > 0.35:
            conviction = Conviction.STRONG_FOR
        elif score > 0.15:
            conviction = Conviction.FOR
        elif score < -0.35:
            conviction = Conviction.STRONG_AGAINST
        elif score < -0.15:
            conviction = Conviction.AGAINST
        else:
            conviction = Conviction.ABSTAIN

        # Action
        if score > 0.15:
            action = TradeAction.LONG
        elif score < -0.15:
            action = TradeAction.SHORT
        else:
            action = TradeAction.HOLD

        # Confidence based on signal strength
        confidence = min(abs(score), 1.0)

        # Size
        size_fraction = min(abs(score) * 0.20, 0.15) if action != TradeAction.HOLD else 0.0

        reasoning = (
            f"🎯 OBI={m.order_book_imbalance:+.2f} | Vol Z={m.volume_z_score:+.1f} | "
            f"Mom aligned={sum(mom_signs)==3} | Score={score:+.2f}"
        )

        return AgentVote(
            role=self.role,
            conviction=conviction,
            action=action,
            size_fraction=size_fraction,
            confidence=confidence,
            reasoning=reasoning,
            latency_ms=0,
            dissent_flags=[]
        )


# ═══════════════════════════════════════════════════════════════════════════
# AGENT 2: NARRATIVE (NLP Specialist)
# ═══════════════════════════════════════════════════════════════════════════

class NarrativeAgent(BaseAgent):
    """
    NLP and sentiment specialist tracking narrative momentum.

    Analyzes:
    - Novelty-weighted sentiment
    - Narrative velocity (NVI)
    - Credibility and sarcasm detection
    - Tweet volume spikes
    """

    def __init__(self):
        super().__init__(AgentRole.NARRATIVE, weight=1.0)

    async def _analyze(self, state: WorldState) -> AgentVote:
        n = state.narrative

        # Sarcasm discount
        sarcasm_discount = 1.0 - (1.5 * n.sarcasm_probability)
        sarcasm_discount = max(0.0, sarcasm_discount)

        # Weighted sentiment
        sent_component = (
            0.40 * n.sentiment_score * sarcasm_discount * n.credibility_factor
        )

        # NVI with coherence
        nvi_component = 0.35 * n.nvi_score * n.narrative_coherence

        # Tweet volume signal
        tweet_signal = 0.25 * np.tanh(n.tweet_volume_z / 3.0)

        # Total score
        score = sent_component + nvi_component + tweet_signal

        # Map to conviction
        if score > 0.40:
            conviction = Conviction.STRONG_FOR
        elif score > 0.20:
            conviction = Conviction.FOR
        elif score < -0.40:
            conviction = Conviction.STRONG_AGAINST
        elif score < -0.20:
            conviction = Conviction.AGAINST
        else:
            conviction = Conviction.ABSTAIN

        # Action
        if score > 0.20:
            action = TradeAction.LONG
        elif score < -0.20:
            action = TradeAction.SHORT
        else:
            action = TradeAction.HOLD

        # Confidence
        confidence = min(abs(score) * 1.5, 1.0)

        # Size
        size_fraction = min(abs(score) * 0.18, 0.12) if action != TradeAction.HOLD else 0.0

        reasoning = (
            f"📰 Sentiment={n.sentiment_score:+.2f} | NVI={n.nvi_score:+.2f} | "
            f"Sarcasm={n.sarcasm_probability:.2f} | Score={score:+.2f}"
        )

        dissent = []
        if n.sarcasm_probability > 0.7:
            dissent.append("HIGH_SARCASM")
        if n.credibility_factor < 0.3:
            dissent.append("LOW_CREDIBILITY")

        return AgentVote(
            role=self.role,
            conviction=conviction,
            action=action,
            size_fraction=size_fraction,
            confidence=confidence,
            reasoning=reasoning,
            latency_ms=0,
            dissent_flags=dissent
        )


# ═══════════════════════════════════════════════════════════════════════════
# AGENT 3: WHALE HUNTER (On-Chain Specialist)
# ═══════════════════════════════════════════════════════════════════════════

class WhaleHunterAgent(BaseAgent):
    """
    On-chain flow tracker following smart money.

    Analyzes:
    - Smart money vs. retail flow
    - Whale concentration
    - Cross-platform arbitrage
    - Gas congestion penalty
    """

    def __init__(self):
        super().__init__(AgentRole.WHALE_HUNTER, weight=1.1)

    async def _analyze(self, state: WorldState) -> AgentVote:
        oc = state.on_chain

        # Gas congestion penalty
        gas_penalty = 1.0
        if oc.gas_congestion_pct > 80:
            gas_penalty = 0.5  # 50% penalty
        elif oc.gas_congestion_pct > 60:
            gas_penalty = 0.75

        # Smart money signal
        smart_component = 0.50 * oc.smart_money_flow

        # Retail fade: if retail + smart money exit together = bearish
        if oc.retail_flow < -0.3 and oc.smart_money_flow < -0.3:
            retail_fade = -0.3
        elif oc.retail_flow > 0.3 and oc.smart_money_flow < -0.2:
            # Retail buying, whales selling = fade retail
            retail_fade = -0.2
        else:
            retail_fade = 0.0

        # Cross-platform arb signal
        arb_signal = 0.20 * np.tanh(oc.cross_platform_spread / 500.0)

        # Total score with gas penalty
        score = (smart_component + retail_fade + arb_signal) * gas_penalty

        # Map to conviction
        if score > 0.35:
            conviction = Conviction.STRONG_FOR
        elif score > 0.18:
            conviction = Conviction.FOR
        elif score < -0.35:
            conviction = Conviction.STRONG_AGAINST
        elif score < -0.18:
            conviction = Conviction.AGAINST
        else:
            conviction = Conviction.ABSTAIN

        # Action
        if score > 0.18:
            action = TradeAction.LONG
        elif score < -0.18:
            action = TradeAction.SHORT
        else:
            action = TradeAction.HOLD

        # Confidence
        confidence = min(abs(score) * 1.2, 1.0)

        # Size
        size_fraction = min(abs(score) * 0.22, 0.15) if action != TradeAction.HOLD else 0.0

        reasoning = (
            f"🐋 Smart money={oc.smart_money_flow:+.2f} | Whale conc={oc.whale_concentration:.2f} | "
            f"Gas={oc.gas_congestion_pct:.0f}% | Score={score:+.2f}"
        )

        dissent = []
        if oc.gas_congestion_pct > 90:
            dissent.append("GAS_CONGESTION_CRITICAL")

        return AgentVote(
            role=self.role,
            conviction=conviction,
            action=action,
            size_fraction=size_fraction,
            confidence=confidence,
            reasoning=reasoning,
            latency_ms=0,
            dissent_flags=dissent
        )


# ═══════════════════════════════════════════════════════════════════════════
# AGENT 4: DOOMER (Risk Veto Agent) - HIGHEST WEIGHT
# ═══════════════════════════════════════════════════════════════════════════

class DoomerAgent(BaseAgent):
    """
    Risk management veto agent with hard kill switches.

    HARD VETOES (instant STRONG_AGAINST):
    - Drawdown > 15%
    - Correlated exposure > 50%
    - Spread > 500 bps
    - Gas congestion > 95%
    - Time to resolution < 2h
    - Leverage > 80%

    Soft risk scoring on other factors.
    """

    def __init__(self):
        super().__init__(AgentRole.DOOMER, weight=1.5)  # Highest weight

    async def _analyze(self, state: WorldState) -> AgentVote:
        p = state.portfolio
        m = state.micro
        oc = state.on_chain

        # HARD VETOES
        veto_reasons = []

        if p.current_drawdown > 0.15:
            veto_reasons.append("DRAWDOWN_LIMIT")
        if p.correlated_exposure > 0.50:
            veto_reasons.append("CORRELATION_LIMIT")
        if m.spread_bps > 500:
            veto_reasons.append("SPREAD_TOO_WIDE")
        if oc.gas_congestion_pct > 95:
            veto_reasons.append("GAS_CONGESTION")
        if p.time_to_resolution_hours < 2.0:
            veto_reasons.append("EXPIRY_TOO_SOON")
        if p.leverage > 0.80:
            veto_reasons.append("LEVERAGE_TOO_HIGH")

        if veto_reasons:
            return AgentVote(
                role=self.role,
                conviction=Conviction.STRONG_AGAINST,
                action=TradeAction.HOLD,
                size_fraction=0.0,
                confidence=1.0,
                reasoning=f"☠️ HARD VETO: {', '.join(veto_reasons)}",
                latency_ms=0,
                dissent_flags=veto_reasons
            )

        # SOFT RISK SCORING
        risk_score = 0.0

        # Drawdown gradient
        if p.current_drawdown > 0.10:
            risk_score -= 0.20
        elif p.current_drawdown > 0.05:
            risk_score -= 0.10

        # IV (uncertainty)
        if p.implied_volatility > 0.5:
            risk_score -= 0.15

        # Overextension
        if p.correlated_exposure > 0.35:
            risk_score -= 0.10

        # Performance metrics
        if p.win_rate < 0.50:
            risk_score -= 0.10
        if p.sharpe_ratio < 0.5:
            risk_score -= 0.10

        # Near expiry warning
        if p.time_to_resolution_hours < 6.0:
            risk_score -= 0.15

        # Map to conviction
        if risk_score < -0.40:
            conviction = Conviction.STRONG_AGAINST
        elif risk_score < -0.20:
            conviction = Conviction.AGAINST
        else:
            conviction = Conviction.ABSTAIN

        action = TradeAction.HOLD if risk_score < -0.20 else TradeAction.HOLD
        confidence = min(abs(risk_score) * 2.0, 1.0)

        reasoning = (
            f"☠️ DD={p.current_drawdown:.1%} | Corr={p.correlated_exposure:.1%} | "
            f"Sharpe={p.sharpe_ratio:.2f} | Risk={risk_score:+.2f}"
        )

        return AgentVote(
            role=self.role,
            conviction=conviction,
            action=action,
            size_fraction=0.0,
            confidence=confidence,
            reasoning=reasoning,
            latency_ms=0,
            dissent_flags=[]
        )


# ═══════════════════════════════════════════════════════════════════════════
# JUDGE AGENT (Final Arbiter)
# ═══════════════════════════════════════════════════════════════════════════

class JudgeAgent:
    """
    Final arbiter that aggregates agent votes into council decision.

    NOT a BaseAgent - synchronous adjudication logic.

    Process:
    1. Check for Doomer veto (conviction <= -1.5)
    2. Compute weighted conviction
    3. Check consensus (minimum 0.6)
    4. Calculate position size
    5. Synthesize reasoning with emoji markers
    """

    def __init__(self):
        self.role = AgentRole.JUDGE

    def adjudicate(
        self,
        votes: List[AgentVote],
        state: WorldState
    ) -> CouncilDecision:
        """
        Aggregate votes into final decision.

        Args:
            votes: List of agent votes
            state: Current world state

        Returns:
            CouncilDecision
        """
        # 1. Check Doomer veto
        doomer_vote = next((v for v in votes if v.role == AgentRole.DOOMER), None)
        if doomer_vote and doomer_vote.conviction.value <= -1:
            return CouncilDecision(
                action=TradeAction.HOLD,
                size_fraction=0.0,
                confidence=1.0,
                edge_estimate=0.0,
                votes=votes,
                consensus_score=0.0,
                doomer_override=True,
                reasoning=f"☠️ DOOMER VETO: {doomer_vote.reasoning}",
                timestamp_ms=state.timestamp_ms
            )

        # 2. Weighted conviction
        weighted_sum = 0.0
        weight_conf_sum = 0.0

        for v in votes:
            agent_weight = self._get_agent_weight(v.role)
            weighted_sum += v.conviction.value * agent_weight * v.confidence
            weight_conf_sum += agent_weight * v.confidence

        avg_conviction = weighted_sum / weight_conf_sum if weight_conf_sum > 0 else 0.0

        # 3. Consensus
        directions = [v.conviction.value for v in votes if v.conviction != Conviction.ABSTAIN]
        consensus = abs(sum(directions)) / len(directions) if directions else 0.0

        if consensus < 0.6:
            return CouncilDecision(
                action=TradeAction.HOLD,
                size_fraction=0.0,
                confidence=consensus,
                edge_estimate=0.0,
                votes=votes,
                consensus_score=consensus,
                doomer_override=False,
                reasoning=f"⚖️ Low consensus ({consensus:.1%}) - HOLD",
                timestamp_ms=state.timestamp_ms
            )

        # 4. Action and size
        if avg_conviction > 0.5:
            action = TradeAction.LONG
        elif avg_conviction < -0.5:
            action = TradeAction.SHORT
        else:
            action = TradeAction.HOLD

        size_fraction = min(abs(avg_conviction) * 0.15, 0.25) if action != TradeAction.HOLD else 0.0

        # 5. Synthesize reasoning
        emojis = {
            AgentRole.SNIPER: "🎯",
            AgentRole.NARRATIVE: "📰",
            AgentRole.WHALE_HUNTER: "🐋",
            AgentRole.DOOMER: "☠️"
        }

        reasoning_parts = []
        for v in votes:
            emoji = emojis.get(v.role, "❓")
            reasoning_parts.append(f"{emoji} {v.conviction.name}: {v.reasoning}")

        reasoning = " | ".join(reasoning_parts)

        # Edge estimate (simplified)
        edge_estimate = avg_conviction * 0.10

        return CouncilDecision(
            action=action,
            size_fraction=size_fraction,
            confidence=consensus,
            edge_estimate=edge_estimate,
            votes=votes,
            consensus_score=consensus,
            doomer_override=False,
            reasoning=reasoning,
            timestamp_ms=state.timestamp_ms
        )

    @staticmethod
    def _get_agent_weight(role: AgentRole) -> float:
        """Get weight for agent role."""
        weights = {
            AgentRole.SNIPER: 1.2,
            AgentRole.NARRATIVE: 1.0,
            AgentRole.WHALE_HUNTER: 1.1,
            AgentRole.DOOMER: 1.5,
        }
        return weights.get(role, 1.0)


# ═══════════════════════════════════════════════════════════════════════════
# THE COUNCIL (Orchestrator)
# ═══════════════════════════════════════════════════════════════════════════

class TheCouncil:
    """
    Orchestrator that convenes agents and produces final decision.

    Launches agents in parallel with timeout, aggregates via Judge.
    Tracks session statistics for monitoring.
    """

    __slots__ = (
        'sniper', 'narrative', 'whale_hunter', 'doomer', 'judge',
        'timeout_seconds', 'sessions', 'trades_approved', 'doomer_vetoes'
    )

    def __init__(self, timeout_seconds: float = 0.5):
        self.sniper = SniperAgent()
        self.narrative = NarrativeAgent()
        self.whale_hunter = WhaleHunterAgent()
        self.doomer = DoomerAgent()
        self.judge = JudgeAgent()

        self.timeout_seconds = timeout_seconds

        # Stats
        self.sessions = 0
        self.trades_approved = 0
        self.doomer_vetoes = 0

    async def convene(self, state: WorldState) -> CouncilDecision:
        """
        Convene the council (async).

        Args:
            state: Current world state

        Returns:
            CouncilDecision
        """
        self.sessions += 1

        # Launch agents in parallel with timeout
        try:
            votes = await asyncio.wait_for(
                asyncio.gather(
                    self.sniper.deliberate(state),
                    self.narrative.deliberate(state),
                    self.whale_hunter.deliberate(state),
                    self.doomer.deliberate(state),
                ),
                timeout=self.timeout_seconds
            )
        except asyncio.TimeoutError:
            # Timeout: emergency HOLD
            return CouncilDecision(
                action=TradeAction.HOLD,
                size_fraction=0.0,
                confidence=0.0,
                edge_estimate=0.0,
                votes=[],
                consensus_score=0.0,
                doomer_override=False,
                reasoning="⏱️ Council timeout - emergency HOLD",
                timestamp_ms=state.timestamp_ms
            )

        # Judge adjudication
        decision = self.judge.adjudicate(votes, state)

        # Update stats
        if decision.doomer_override:
            self.doomer_vetoes += 1
        if decision.action in [TradeAction.LONG, TradeAction.SHORT]:
            self.trades_approved += 1

        return decision

    def convene_sync(self, state: WorldState) -> CouncilDecision:
        """
        Synchronous wrapper for convene().

        Args:
            state: Current world state

        Returns:
            CouncilDecision
        """
        return asyncio.run(self.convene(state))

    def __repr__(self) -> str:
        return (
            f"TheCouncil(sessions={self.sessions}, "
            f"approved={self.trades_approved}, vetoes={self.doomer_vetoes})"
        )
