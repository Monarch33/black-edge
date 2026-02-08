"""
RL Environment - Polygon Prediction Market Gym

Components:
1. ChaosAgent: Adversarial event injector for robustness training
2. PolygonGymEnv: OpenAI Gym-compatible environment

The Chaos Agent injects market shocks, liquidity drains, gas spikes,
and other adversarial events to train robust policies.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Tuple, Dict, List

import numpy as np

from ..config import SimulationConfig
from ..council.agents import (
    WorldState, MarketMicrostructure, NarrativeState,
    OnChainState, PortfolioState
)


# ═══════════════════════════════════════════════════════════════════════════
# CHAOS AGENT (Adversarial Event Injector)
# ═══════════════════════════════════════════════════════════════════════════

class ChaosEvent(Enum):
    """Types of adversarial events the Chaos Agent can trigger."""
    FLASH_CRASH = 'FLASH_CRASH'
    LIQUIDITY_DRAIN = 'LIQUIDITY_DRAIN'
    WHALE_DUMP = 'WHALE_DUMP'
    GAS_SPIKE = 'GAS_SPIKE'
    NARRATIVE_REVERSAL = 'NARRATIVE_REVERSAL'
    SANDWICH_ATTACK = 'SANDWICH_ATTACK'


@dataclass
class ActiveEffect:
    """Active chaos effect with remaining duration."""
    event_type: ChaosEvent
    intensity: float
    remaining_steps: int


class ChaosAgent:
    """
    Adversarial agent that injects market chaos for robustness training.

    Triggers random events with configurable probability:
    - Flash crashes (-10% to -20% over 5-15 steps)
    - Liquidity drains (depth × 0.2 for 10-30 steps)
    - Whale dumps (-5% to -15% instant)
    - Gas spikes (3-10× for 5-20 steps)
    - Narrative reversals (flip sentiment for 10-50 steps)
    - Sandwich attacks (conditional on agent trading, +1-5% slippage)

    Example:
        >>> chaos = ChaosAgent(probability=0.05)
        >>> mods = chaos.step(state, agent_action)
        >>> price *= (1 + mods['price_shock'])
    """

    __slots__ = ('probability', 'active_effects', 'rng', 'event_count')

    def __init__(self, probability: float = 0.05, seed: Optional[int] = None):
        """
        Initialize Chaos Agent.

        Args:
            probability: Probability of triggering new event per step (default 5%)
            seed: Random seed for reproducibility
        """
        self.probability = probability
        self.active_effects: List[ActiveEffect] = []
        self.rng = np.random.default_rng(seed)
        self.event_count = 0

    def step(self, state: dict, agent_action: np.ndarray) -> dict:
        """
        Apply chaos effects for current step.

        Args:
            state: Current environment state
            agent_action: Agent's action (for conditional sandwich attack)

        Returns:
            Dictionary of modifications:
            - price_shock: Additive price change
            - liquidity_mult: Liquidity multiplier
            - extra_slippage: Additional slippage
            - gas_mult: Gas cost multiplier
            - sentiment_flip: Sentiment reversal (-1 = full flip)
        """
        modifications = {
            'price_shock': 0.0,
            'liquidity_mult': 1.0,
            'extra_slippage': 0.0,
            'gas_mult': 1.0,
            'sentiment_flip': 0.0,
        }

        # Decay existing effects
        self._decay_effects()

        # Trigger new event?
        if self.rng.random() < self.probability:
            self._trigger_random_event()

        # Sandwich attack (conditional on agent trading)
        if np.max(np.abs(agent_action[:2])) > 0.01:  # Agent is trading
            if self.rng.random() < 0.02:  # 2% chance
                slippage_penalty = self.rng.uniform(0.01, 0.05)
                modifications['extra_slippage'] = slippage_penalty
                self.event_count += 1

        # Apply all active effects
        for effect in self.active_effects:
            self._apply_effect(effect, modifications)

        return modifications

    def _trigger_random_event(self):
        """Randomly select and trigger a chaos event."""
        # Exclude SANDWICH_ATTACK (conditional only)
        event_type = self.rng.choice([
            ChaosEvent.FLASH_CRASH,
            ChaosEvent.LIQUIDITY_DRAIN,
            ChaosEvent.WHALE_DUMP,
            ChaosEvent.GAS_SPIKE,
            ChaosEvent.NARRATIVE_REVERSAL,
        ])

        if event_type == ChaosEvent.FLASH_CRASH:
            intensity = self.rng.uniform(-0.20, -0.10)  # -10% to -20%
            duration = self.rng.integers(5, 16)
        elif event_type == ChaosEvent.LIQUIDITY_DRAIN:
            intensity = 0.2  # Multiplier (depth × 0.2)
            duration = self.rng.integers(10, 31)
        elif event_type == ChaosEvent.WHALE_DUMP:
            intensity = self.rng.uniform(-0.15, -0.05)  # -5% to -15%
            duration = 1  # Instant
        elif event_type == ChaosEvent.GAS_SPIKE:
            intensity = self.rng.uniform(3.0, 10.0)  # 3-10×
            duration = self.rng.integers(5, 21)
        elif event_type == ChaosEvent.NARRATIVE_REVERSAL:
            intensity = 1.0  # Full flip
            duration = self.rng.integers(10, 51)
        else:
            return

        self.active_effects.append(ActiveEffect(event_type, intensity, duration))
        self.event_count += 1

    def _apply_effect(self, effect: ActiveEffect, modifications: dict):
        """Apply a single active effect to modifications."""
        if effect.event_type == ChaosEvent.FLASH_CRASH:
            # Spread crash over duration
            modifications['price_shock'] += effect.intensity / effect.remaining_steps
        elif effect.event_type == ChaosEvent.LIQUIDITY_DRAIN:
            modifications['liquidity_mult'] *= effect.intensity
        elif effect.event_type == ChaosEvent.WHALE_DUMP:
            modifications['price_shock'] += effect.intensity
        elif effect.event_type == ChaosEvent.GAS_SPIKE:
            modifications['gas_mult'] *= effect.intensity
        elif effect.event_type == ChaosEvent.NARRATIVE_REVERSAL:
            modifications['sentiment_flip'] = -1.0

    def _decay_effects(self):
        """Decay all active effects by 1 step, remove expired."""
        self.active_effects = [
            ActiveEffect(e.event_type, e.intensity, e.remaining_steps - 1)
            for e in self.active_effects
            if e.remaining_steps > 1
        ]

    def reset(self):
        """Clear all active effects."""
        self.active_effects = []

    def __repr__(self) -> str:
        return (f"ChaosAgent(probability={self.probability:.1%}, "
                f"active_effects={len(self.active_effects)}, "
                f"total_events={self.event_count})")


# ═══════════════════════════════════════════════════════════════════════════
# POLYGON GYM ENVIRONMENT (OpenAI Gym Compatible)
# ═══════════════════════════════════════════════════════════════════════════

class PolygonGymEnv:
    """
    OpenAI Gym-compatible environment for prediction market RL training.

    Observation Space: 27D continuous (WorldState vector)
    Action Space: 3D continuous [long_size, short_size, hold_strength]

    The environment replays historical price/volume data with noise,
    applies chaos events, simulates realistic slippage and gas costs,
    and computes rewards based on PnL and drawdown.

    Example:
        >>> env = PolygonGymEnv(prices, volumes)
        >>> obs, info = env.reset()
        >>> for _ in range(1000):
        ...     action = agent.predict(obs)
        ...     obs, reward, done, truncated, info = env.step(action)
    """

    def __init__(
        self,
        historical_prices: np.ndarray,
        historical_volumes: np.ndarray,
        config: Optional[SimulationConfig] = None,
        seed: Optional[int] = None
    ):
        """
        Initialize RL environment.

        Args:
            historical_prices: Historical price series [0, 1]
            historical_volumes: Historical volume series (USD)
            config: Simulation configuration
            seed: Random seed
        """
        self.config = config or SimulationConfig()
        self.historical_prices = historical_prices
        self.historical_volumes = historical_volumes

        self.rng = np.random.default_rng(seed)
        self.chaos = ChaosAgent(
            probability=self.config.chaos_agent_probability,
            seed=seed
        )

        # State variables
        self.step_count = 0
        self.cash = self.config.initial_cash_usd
        self.position = 0.0  # Shares held
        self.current_price = 0.5
        self.portfolio_value = self.cash

        # Statistics
        self.trade_count = 0
        self.gas_spent = 0.0
        self.peak_portfolio_value = self.cash
        self.initial_value = self.cash

    def reset(self, seed: Optional[int] = None) -> Tuple[np.ndarray, dict]:
        """
        Reset environment to initial state.

        Args:
            seed: Optional new random seed

        Returns:
            Tuple of (observation, info)
        """
        if seed is not None:
            self.rng = np.random.default_rng(seed)
            self.chaos = ChaosAgent(
                probability=self.config.chaos_agent_probability,
                seed=seed
            )

        self.step_count = 0
        self.cash = self.config.initial_cash_usd
        self.position = 0.0
        self.current_price = (
            self.historical_prices[0]
            if len(self.historical_prices) > 0
            else 0.5
        )
        self.portfolio_value = self.cash
        self.trade_count = 0
        self.gas_spent = 0.0
        self.peak_portfolio_value = self.cash
        self.initial_value = self.cash

        self.chaos.reset()

        obs = self._get_observation()
        info = self._get_info()

        return obs, info

    def step(self, action: np.ndarray) -> Tuple[np.ndarray, float, bool, bool, dict]:
        """
        Execute one environment step.

        Args:
            action: [long_size, short_size, hold_strength] in [-1, 1]

        Returns:
            Tuple of (observation, reward, terminated, truncated, info)
        """
        self.step_count += 1

        # ═══ 1. ADVANCE PRICE (historical replay + noise) ═══
        idx = min(self.step_count, len(self.historical_prices) - 1)
        base_price = self.historical_prices[idx]
        noise = self.rng.normal(0, 0.002)  # 0.2% gaussian noise
        self.current_price = np.clip(base_price + noise, 0.01, 0.99)

        # ═══ 2. APPLY CHAOS ═══
        chaos_mods = self.chaos.step({}, action)
        self.current_price = np.clip(
            self.current_price * (1 + chaos_mods['price_shock']),
            0.01, 0.99
        )

        # ═══ 3. EXECUTE ACTION ═══
        long_size, short_size, hold_strength = action

        # Softmax to determine dominant action
        action_logits = np.array([long_size, short_size, hold_strength])
        action_probs = np.exp(action_logits) / np.sum(np.exp(action_logits))

        dominant_idx = np.argmax(action_probs)

        if dominant_idx == 0:  # LONG
            trade_size_usd = abs(long_size) * self.cash * 0.25  # Max 25% of cash
            self._execute_trade(trade_size_usd, 'BUY', chaos_mods)
        elif dominant_idx == 1:  # SHORT
            if self.position > 0:
                trade_size_usd = abs(short_size) * abs(self.position * self.current_price) * 0.5
                self._execute_trade(trade_size_usd, 'SELL', chaos_mods)
        # else: HOLD (do nothing)

        # ═══ 4. CALCULATE REWARD ═══
        reward = self._calculate_reward()

        # ═══ 5. CHECK TERMINATION ═══
        self.portfolio_value = self.cash + self.position * self.current_price
        terminated = False
        truncated = False

        # Blown up (lost >50% of capital)
        if self.portfolio_value < self.initial_value * 0.5:
            terminated = True
            reward = -10.0  # Large penalty

        # Max steps reached
        if self.step_count >= self.config.max_episode_steps:
            truncated = True

        obs = self._get_observation()
        info = self._get_info()

        return obs, reward, terminated, truncated, info

    def _execute_trade(self, trade_size_usd: float, side: str, chaos_mods: dict):
        """
        Execute a trade with slippage and gas costs.

        Args:
            trade_size_usd: Trade size in USD
            side: 'BUY' or 'SELL'
            chaos_mods: Chaos modifications
        """
        if abs(trade_size_usd) < 100:  # Min trade size $100
            return

        # ═══ SLIPPAGE MODEL ═══
        idx = min(self.step_count, len(self.historical_volumes) - 1)
        daily_volume = self.historical_volumes[idx]

        # Linear slippage: 0.05 × (trade_size / daily_volume)
        slippage_pct = 0.05 * (abs(trade_size_usd) / max(daily_volume, 1000))
        slippage_pct += chaos_mods['extra_slippage']
        slippage_pct = min(slippage_pct, 0.20)  # Cap at 20%

        # Apply slippage
        if side == 'BUY':
            effective_price = self.current_price * (1 + slippage_pct)
        else:
            effective_price = self.current_price * (1 - slippage_pct)

        # ═══ GAS COST ═══
        # Base: 150k gas × 30 gwei × chaos multiplier
        gas_cost_usd = 150000 * 30 * chaos_mods['gas_mult'] / 1e9 * 2000  # ~$9 base
        gas_cost_usd = min(gas_cost_usd, trade_size_usd * 0.05)  # Cap at 5% of trade

        # ═══ EXECUTE ═══
        if side == 'BUY':
            total_cost = trade_size_usd + gas_cost_usd
            if total_cost <= self.cash:
                shares_bought = trade_size_usd / effective_price
                self.cash -= total_cost
                self.position += shares_bought
                self.trade_count += 1
                self.gas_spent += gas_cost_usd
        else:  # SELL
            shares_to_sell = min(trade_size_usd / effective_price, self.position)
            if shares_to_sell > 0:
                proceeds = shares_to_sell * effective_price - gas_cost_usd
                self.cash += proceeds
                self.position -= shares_to_sell
                self.trade_count += 1
                self.gas_spent += gas_cost_usd

    def _calculate_reward(self) -> float:
        """
        Calculate step reward.

        Reward = PnL% - 0.5 × Drawdown%
        """
        current_value = self.cash + self.position * self.current_price

        # Update peak
        self.peak_portfolio_value = max(self.peak_portfolio_value, current_value)

        # PnL percentage
        pnl_pct = (current_value - self.initial_value) / self.initial_value

        # Drawdown from peak
        drawdown = (self.peak_portfolio_value - current_value) / self.peak_portfolio_value

        # Reward = PnL - drawdown penalty
        reward = pnl_pct - drawdown * 0.5

        return reward

    def _get_observation(self) -> np.ndarray:
        """
        Get current observation (27D WorldState vector).

        Returns:
            27D numpy array
        """
        # Build WorldState
        current_value = self.cash + self.position * self.current_price
        drawdown = (self.peak_portfolio_value - current_value) / max(self.peak_portfolio_value, 1)
        leverage = abs(self.position * self.current_price) / max(self.cash, 1)

        state = WorldState(
            market_id='rl-sim',
            timestamp_ms=self.step_count * self.config.tick_interval_ms,
            mid_price=self.current_price,
            micro=MarketMicrostructure(
                order_book_imbalance=self.rng.normal(0, 0.3),
                volume_z_score=self.rng.normal(0, 1.5),
                momentum_1h=0.0,
                momentum_4h=0.0,
                momentum_24h=0.0,
                spread_bps=100.0,
                liquidity_depth_usd=10000.0,
                price_reversion_score=0.0
            ),
            narrative=NarrativeState(
                sentiment_score=0.0,
                nvi_score=0.0,
                novelty_index=0.5,
                credibility_factor=0.5,
                sarcasm_probability=0.1,
                tweet_volume_z=0.0,
                narrative_coherence=0.5
            ),
            on_chain=OnChainState(
                smart_money_flow=0.0,
                whale_concentration=0.3,
                retail_flow=0.0,
                cross_platform_spread=100.0,
                gas_congestion_pct=50.0
            ),
            portfolio=PortfolioState(
                current_drawdown=drawdown,
                correlated_exposure=0.0,
                leverage=leverage,
                sharpe_ratio=1.0,
                win_rate=0.5,
                time_to_resolution_hours=24.0,
                implied_volatility=0.2
            )
        )

        return state.to_vector()

    def _get_info(self) -> dict:
        """Get info dictionary."""
        return {
            'step': self.step_count,
            'portfolio_value': self.portfolio_value,
            'cash': self.cash,
            'position': self.position,
            'price': self.current_price,
            'trade_count': self.trade_count,
            'gas_spent': self.gas_spent,
            'drawdown': (self.peak_portfolio_value - self.portfolio_value) / max(self.peak_portfolio_value, 1),
            'pnl_pct': (self.portfolio_value - self.initial_value) / self.initial_value,
        }

    def __repr__(self) -> str:
        return (f"PolygonGymEnv(step={self.step_count}, "
                f"portfolio=${self.portfolio_value:,.0f}, "
                f"trades={self.trade_count})")
