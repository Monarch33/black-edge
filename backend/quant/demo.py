"""
Black Edge V2 - End-to-End Pipeline Demo (FIXED)
=================================================
Comprehensive demonstration of all quant components working together.

All method signatures and field names now match the actual module implementations.
"""

from __future__ import annotations

import asyncio
import random
import time
from datetime import datetime, timedelta

import numpy as np


# =============================================================================
# Emoji Config
# =============================================================================

EMOJI_MAP = {
    'SNIPER': '🎯',
    'NARRATIVE': '📰',
    'WHALE_HUNTER': '🐋',
    'DOOMER': '⚠️',
    'JUDGE': '⚖️',
    'BUY': '🟢',
    'SELL': '🔴',
    'HOLD': '⚪',
    'LONG': '📈',
    'SHORT': '📉',
    'SUCCESS': '✅',
    'WARNING': '⚠️',
    'INFO': 'ℹ️',
    'ROCKET': '🚀',
    'CHART': '📊',
    'CLOCK': '⏱️',
}


# =============================================================================
# Utility Functions
# =============================================================================

def print_section(title: str, emoji: str = ''):
    """Print a formatted section header."""
    if emoji:
        print(f"\n{emoji}  {title}")
    else:
        print(f"\n{title}")
    print("=" * 80)


def print_subsection(title: str):
    """Print a formatted subsection."""
    print(f"\n{title}")
    print("-" * 80)


def format_latency(ms: float) -> str:
    """Format latency with color coding."""
    if ms < 10:
        return f"{ms:.2f}ms (FAST)"
    elif ms < 50:
        return f"{ms:.2f}ms (OK)"
    else:
        return f"{ms:.2f}ms (SLOW)"


def generate_synthetic_ticks(n: int = 200, drift: float = 0.0005) -> list[dict]:
    """Generate synthetic market ticks with random walk + bullish drift."""
    base_time = int((datetime.now().replace(tzinfo=None) - timedelta(hours=24)).timestamp() * 1000)
    base_price = 0.50

    ticks = []
    current_price = base_price

    for i in range(n):
        change = np.random.normal(drift, 0.01)
        current_price = np.clip(current_price * (1 + change), 0.01, 0.99)

        tick = {
            'timestamp_ms': base_time + i * 60000,
            'price': current_price,
            'bid': current_price - 0.01,
            'ask': current_price + 0.01,
            'volume': random.uniform(1000, 10000)
        }
        ticks.append(tick)

    return ticks


def generate_synthetic_headlines() -> list[dict]:
    """Generate synthetic headlines: 6 baseline (24h ago) + 5 recent bullish."""
    base_time = int(datetime.now().replace(tzinfo=None).timestamp() * 1000)

    baseline = [
        "Markets open steady after weekend",
        "Analysts discuss quarterly outlook",
        "Trading volume moderate in Asian session",
        "Technical indicators show mixed signals",
        "Investors await economic data release",
        "Market sentiment remains cautious"
    ]

    bullish = [
        "BREAKING: Major institutional buy order detected",
        "Trump surges in latest polls, market reacts",
        "Whale wallets accumulating aggressively",
        "URGENT: Smart money flowing into YES positions",
        "Breaking news: Momentum accelerating on Trump win"
    ]

    headlines = []

    for i, text in enumerate(baseline):
        headlines.append({
            'text': text,
            'timestamp_ms': base_time - 86400000 + i * 14400000
        })

    for i, text in enumerate(bullish):
        headlines.append({
            'text': text,
            'timestamp_ms': base_time - 3600000 + i * 600000
        })

    return headlines


def generate_synthetic_whales() -> list[dict]:
    """
    Generate 2 synthetic whale wallets matching SQL_IDENTIFY_WHALES output.

    IMPORTANT: Field names must match load_from_query_results expectations:
    - wallet_address (not address) - from SQL query
    """
    return [
        {
            'wallet_address': '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            'total_volume_usd': 500000.0,
            'total_trades': 45,
            'win_rate': 0.72,
            'pnl_usd': 125000.0,
            'sharpe_ratio': 2.8,
            'avg_trade_size_usd': 11111.0,
            'last_active_ms': int(datetime.now().replace(tzinfo=None).timestamp() * 1000),
        },
        {
            'wallet_address': '0x8f03e1f6e8e3e18f0d13c3d29c4f9a0123456789',
            'total_volume_usd': 350000.0,
            'total_trades': 32,
            'win_rate': 0.68,
            'pnl_usd': 89000.0,
            'sharpe_ratio': 2.3,
            'avg_trade_size_usd': 10937.0,
            'last_active_ms': int(datetime.now().replace(tzinfo=None).timestamp() * 1000),
        }
    ]


# =============================================================================
# Main Demo
# =============================================================================

async def main():
    """Run end-to-end pipeline demo."""

    print("\n" + "=" * 80)
    print("🚀  BLACK EDGE V2 - END-TO-END PIPELINE DEMO")
    print("=" * 80)
    print(f"Timestamp: {datetime.now().replace(tzinfo=None).isoformat()}")
    print(f"Testing: All quant components integrated")
    print("=" * 80)

    latencies = {}

    # =========================================================================
    # 1. INITIALIZE COMPONENTS
    # =========================================================================

    print_section("1. COMPONENT INITIALIZATION", EMOJI_MAP['ROCKET'])

    t0 = time.perf_counter()

    from quant.feature_engineer import FeatureEngineer
    from quant.narrative_velocity import NarrativeVelocityLite
    from quant.whale_tracker import WhaleWatchlist, WhaleWallet
    from quant.quant_model import QuantModel
    from quant.council.agents import TheCouncil, WorldState, MarketMicrostructure, NarrativeState, OnChainState, PortfolioState
    from quant.risk.manager import RiskManager, detect_arb_opportunity
    from quant.rl.environment import PolygonGymEnv
    from quant.rl.reward import RewardFunction

    feature_engineer = FeatureEngineer()
    narrative_velocity = NarrativeVelocityLite()
    whale_watchlist = WhaleWatchlist()
    quant_model = QuantModel()
    council = TheCouncil()
    risk_manager = RiskManager()

    # Initialize RL environment with dummy historical data
    dummy_prices = np.random.uniform(0.45, 0.55, size=1000)
    dummy_volumes = np.random.uniform(1000, 10000, size=1000)
    rl_env = PolygonGymEnv(historical_prices=dummy_prices, historical_volumes=dummy_volumes)

    reward_fn = RewardFunction()

    t1 = time.perf_counter()
    latencies['initialization'] = (t1 - t0) * 1000

    print(f"✅ FeatureEngineer initialized")
    print(f"✅ NarrativeVelocityLite initialized")
    print(f"✅ WhaleWatchlist initialized")
    print(f"✅ QuantModel initialized")
    print(f"✅ TheCouncil initialized")
    print(f"✅ RiskManager initialized")
    print(f"✅ PolygonGymEnv initialized")
    print(f"✅ RewardFunction initialized")
    print(f"\n⏱️  Initialization: {format_latency(latencies['initialization'])}")

    # =========================================================================
    # 2. GENERATE & INGEST SYNTHETIC DATA
    # =========================================================================

    print_section("2. DATA INGESTION", EMOJI_MAP['CHART'])

    market_id = "TRUMP_WINS_2024"

    # Generate synthetic ticks
    print_subsection("Generating Synthetic Ticks")
    t0 = time.perf_counter()
    ticks = generate_synthetic_ticks(n=200, drift=0.0005)
    t1 = time.perf_counter()
    latencies['tick_generation'] = (t1 - t0) * 1000

    print(f"Generated {len(ticks)} ticks")
    print(f"Price range: ${ticks[0]['price']:.3f} → ${ticks[-1]['price']:.3f}")
    print(f"Drift: {((ticks[-1]['price'] / ticks[0]['price']) - 1) * 100:.1f}%")
    print(f"⏱️  Generation: {format_latency(latencies['tick_generation'])}")

    # Ingest ticks
    print_subsection("Ingesting Ticks into FeatureEngineer")
    t0 = time.perf_counter()

    from quant.config import MarketTick, OrderBookSnapshot, OrderBookLevel

    for tick in ticks:
        # Create MarketTick object with EXACT fields from audit
        market_tick = MarketTick(
            market_id=market_id,
            timestamp_ms=tick['timestamp_ms'],
            mid_price=tick['price'],
            best_bid=tick['bid'],
            best_ask=tick['ask'],
            bid_depth_usd=10000.0,
            ask_depth_usd=10000.0,
            volume_1h_usd=tick['volume'],
            volume_24h_usd=tick['volume'] * 24,
            trade_count_1h=random.randint(5, 50),
            last_trade_price=tick['price']
        )
        feature_engineer.ingest_tick(market_tick)

        # Create OrderBookSnapshot object
        orderbook = OrderBookSnapshot(
            market_id=market_id,
            timestamp_ms=tick['timestamp_ms'],
            bids=[OrderBookLevel(price=tick['bid'], size=10000.0)],
            asks=[OrderBookLevel(price=tick['ask'], size=10000.0)]
        )
        feature_engineer.ingest_orderbook(orderbook)

    t1 = time.perf_counter()
    latencies['tick_ingestion'] = (t1 - t0) * 1000

    print(f"✅ Ingested {len(ticks)} ticks")
    print(f"⏱️  Ingestion: {format_latency(latencies['tick_ingestion'])}")

    # Generate headlines
    print_subsection("Generating & Ingesting Headlines")
    t0 = time.perf_counter()
    headlines = generate_synthetic_headlines()
    t1 = time.perf_counter()
    latencies['headline_generation'] = (t1 - t0) * 1000

    print(f"Generated {len(headlines)} headlines:")
    print(f"  • Baseline (24h ago): 6")
    print(f"  • Recent bullish: 5")
    print(f"⏱️  Generation: {format_latency(latencies['headline_generation'])}")

    # Ingest headlines - USE CORRECT METHOD NAMES FROM AUDIT
    t0 = time.perf_counter()
    for headline in headlines:
        # FeatureEngineer.ingest_headline(headline: str, timestamp_ms: int, market_id: str)
        feature_engineer.ingest_headline(
            headline=headline['text'],
            timestamp_ms=headline['timestamp_ms'],
            market_id=market_id
        )
        # NarrativeVelocityLite.ingest(text: str, market_id: str, timestamp_ms: int)
        narrative_velocity.ingest(
            text=headline['text'],
            market_id=market_id,
            timestamp_ms=headline['timestamp_ms']
        )
    t1 = time.perf_counter()
    latencies['headline_ingestion'] = (t1 - t0) * 1000

    print(f"✅ Ingested {len(headlines)} headlines")
    print(f"⏱️  Ingestion: {format_latency(latencies['headline_ingestion'])}")

    # Load whales - USE EXACT WhaleWallet FIELDS FROM AUDIT
    print_subsection("Loading Synthetic Whales")
    t0 = time.perf_counter()
    whales = generate_synthetic_whales()

    # Load using load_from_query_results which expects list[dict] with exact field names
    whale_watchlist.load_from_query_results(whales)

    t1 = time.perf_counter()
    latencies['whale_loading'] = (t1 - t0) * 1000

    print(f"✅ Loaded {len(whales)} whales")
    for w in whales:
        print(f"  • {w['wallet_address'][:10]}... PnL: ${w['pnl_usd']:,.0f}, "
              f"Sharpe: {w['sharpe_ratio']:.1f}, WR: {w['win_rate']:.0%}")
    print(f"⏱️  Loading: {format_latency(latencies['whale_loading'])}")

    # =========================================================================
    # 3. COMPUTE FEATURES & SIGNALS
    # =========================================================================

    print_section("3. FEATURE COMPUTATION & SIGNAL GENERATION", EMOJI_MAP['CHART'])

    # Compute features - METHOD: compute(market_id: str) -> FeatureVector
    print_subsection("Computing Features")
    t0 = time.perf_counter()
    features = feature_engineer.compute(market_id)
    t1 = time.perf_counter()
    latencies['feature_computation'] = (t1 - t0) * 1000

    print(f"✅ Feature Vector:")
    print(f"  • OBI:              {features.order_book_imbalance:+.3f}")
    print(f"  • Volume Z-Score:   {features.volume_z_score:+.2f}")
    print(f"  • Implied Vol:      {features.implied_volatility:.3f}")
    print(f"  • Momentum 1h:      {features.momentum_1h:+.3f}")
    print(f"  • Sentiment:        {features.sentiment_score:+.3f}")
    print(f"  • Mid Price:        ${features.mid_price:.3f}")
    print(f"  • Spread:           {features.spread_bps:.0f} bps")
    print(f"  • Valid:            {features.is_valid}")
    print(f"⏱️  Computation: {format_latency(latencies['feature_computation'])}")

    # Compute narrative signal - METHOD: compute(market_id: str, current_ts: Optional[int] = None) -> NarrativeSignal
    print_subsection("Computing Narrative Velocity")
    t0 = time.perf_counter()
    narrative = narrative_velocity.compute(market_id)
    t1 = time.perf_counter()
    latencies['narrative_computation'] = (t1 - t0) * 1000

    print(f"✅ Narrative Signal:")
    print(f"  • NVI Score:        {narrative.nvi_score:+.3f}")
    print(f"  • Keyword Velocity: {narrative.keyword_velocity:.2f}")
    print(f"  • Accelerating:     {narrative.is_accelerating}")
    if narrative.dominant_keyword:
        print(f"  • Dominant Keyword: '{narrative.dominant_keyword}'")
    # top_keywords is list[tuple[str, float]] - unpack correctly
    if narrative.top_keywords:
        keywords_str = ', '.join([kw[0] for kw in narrative.top_keywords[:3]])
        print(f"  • Top Keywords:     {keywords_str}")
    print(f"⏱️  Computation: {format_latency(latencies['narrative_computation'])}")

    # Check whale alignment
    whale_aligned = whale_watchlist.is_whale(whales[0]['wallet_address'])

    # Compute QuantModel signal - METHOD: compute_signal(features, narrative, whale_is_aligned) -> SignalOutput
    print_subsection("Computing QuantModel Signal")
    t0 = time.perf_counter()
    signal = quant_model.compute_signal(features, narrative, whale_aligned)
    t1 = time.perf_counter()
    latencies['signal_computation'] = (t1 - t0) * 1000

    signal_emoji = EMOJI_MAP.get(signal.signal.name, '❓')
    print(f"✅ QuantModel Signal:")
    print(f"  • Signal:           {signal_emoji} {signal.signal.name}")
    print(f"  • Edge:             {signal.edge:+.3f} ({signal.edge*100:+.1f}%)")
    print(f"  • Confidence:       {signal.confidence:.2f}")
    print(f"  • Market Price:     ${signal.market_price:.3f}")
    print(f"  • Tradeable:        {signal.tradeable}")  # FIELD: tradeable (not is_tradeable)
    print(f"⏱️  Computation: {format_latency(latencies['signal_computation'])}")

    # =========================================================================
    # 4. COUNCIL DECISION
    # =========================================================================

    print_section("4. MULTI-AGENT COUNCIL VOTE", EMOJI_MAP['JUDGE'])

    # Build WorldState with EXACT sub-dataclass fields from audit
    world_state = WorldState(
        market_id=market_id,
        timestamp_ms=int(datetime.now().replace(tzinfo=None).timestamp() * 1000),
        mid_price=features.mid_price,
        micro=MarketMicrostructure(
            order_book_imbalance=features.order_book_imbalance,
            volume_z_score=features.volume_z_score,
            momentum_1h=features.momentum_1h,
            momentum_4h=0.08,  # Mock value
            momentum_24h=0.12,  # Mock value
            spread_bps=features.spread_bps,
            liquidity_depth_usd=50000.0,
            price_reversion_score=0.3
        ),
        narrative=NarrativeState(
            sentiment_score=features.sentiment_score,
            nvi_score=narrative.nvi_score,
            novelty_index=0.7,
            credibility_factor=0.8,
            sarcasm_probability=0.1,
            tweet_volume_z=narrative.keyword_velocity,  # Use keyword_velocity (no z_score in NarrativeSignal)
            narrative_coherence=0.75
        ),
        on_chain=OnChainState(
            smart_money_flow=0.2,
            whale_concentration=0.35,
            retail_flow=-0.1,
            cross_platform_spread=0.02,
            gas_congestion_pct=0.45
        ),
        portfolio=PortfolioState(
            current_drawdown=0.05,
            correlated_exposure=0.25,
            leverage=0.30,
            sharpe_ratio=1.8,
            win_rate=0.65,
            time_to_resolution_hours=72.0,
            implied_volatility=features.implied_volatility
        )
    )

    # Convene Council - METHOD: convene(state: WorldState) -> CouncilDecision
    print_subsection("Convening Council")
    t0 = time.perf_counter()
    decision = await council.convene(world_state)
    t1 = time.perf_counter()
    latencies['council_convene'] = (t1 - t0) * 1000

    print(f"\n🗳️  AGENT VOTES:")
    print("-" * 80)
    for vote in decision.votes:
        agent_emoji = EMOJI_MAP.get(vote.role.name, '❓')  # role, not agent
        conviction_map = {0: '⚪ AGAINST', 1: '🟢 FOR', 2: '🟢 STRONG_FOR'}
        conviction_emoji = conviction_map.get(vote.conviction, '❓')
        print(f"  {agent_emoji} {vote.role.name:15} "  # role, not agent
              f"{conviction_emoji:15} "
              f"Conf: {vote.confidence:.2f}  Size: {vote.size_fraction:.2%}")

    action_emoji = EMOJI_MAP.get(decision.action.name, '❓')
    print(f"\n⚖️  JUDGE DECISION:")
    print(f"  • Action:           {action_emoji} {decision.action.name}")
    print(f"  • Size Fraction:    {decision.size_fraction:.2%}")
    print(f"  • Confidence:       {decision.confidence:.2f}")
    print(f"  • Edge Estimate:    {decision.edge_estimate:+.3f}")
    print(f"  • Consensus Score:  {decision.consensus_score:.2f}")
    print(f"  • Doomer Override:  {decision.doomer_override}")
    if decision.reasoning:
        print(f"  • Reasoning:        {decision.reasoning}")
    print(f"\n⏱️  Council: {format_latency(latencies['council_convene'])}")

    # =========================================================================
    # 5. RISK MANAGEMENT
    # =========================================================================

    print_section("5. RISK MANAGEMENT", EMOJI_MAP['WARNING'])

    # Test arbitrage detection
    print_subsection("Arbitrage Detection")
    t0 = time.perf_counter()
    arb = detect_arb_opportunity(
        polymarket_price=0.62,
        kalshi_price=0.57,
        fees=0.02
    )
    t1 = time.perf_counter()
    latencies['arb_detection'] = (t1 - t0) * 1000

    arb_emoji = '✅' if arb.is_arb else '❌'
    print(f"{arb_emoji} Arbitrage Opportunity:")
    print(f"  • Is Arb:           {arb.is_arb}")
    print(f"  • Profit:           {arb.profit_pct:.3f} ({arb.profit_pct*100:.1f}%)")
    print(f"  • Buy Side:         {arb.buy_side}")
    print(f"  • Sell Side:        {arb.sell_side}")
    print(f"  • Capital Required: ${arb.required_capital:.4f}")
    print(f"⏱️  Detection: {format_latency(latencies['arb_detection'])}")

    # Test trailing stop
    print_subsection("Trailing Stop Mechanism")
    t0 = time.perf_counter()
    stop_id = risk_manager.add_trailing_stop("test_position", entry_price=0.50)

    # Simulate price movement
    triggered1, reason1 = risk_manager.update_stop(stop_id, 0.60)
    triggered2, reason2 = risk_manager.update_stop(stop_id, 0.52)
    triggered3, reason3 = risk_manager.update_stop(stop_id, 0.50)

    t1 = time.perf_counter()
    latencies['trailing_stop'] = (t1 - t0) * 1000

    print(f"✅ Trailing Stop Test:")
    print(f"  • Entry:            $0.50")
    print(f"  • Price → $0.60:    {reason1} (HWM updated)")
    print(f"  • Price → $0.52:    {reason2} (still above stop)")
    print(f"  • Price → $0.50:    {reason3} ({'TRIGGERED' if triggered3 else 'ACTIVE'})")
    print(f"⏱️  Stop Test: {format_latency(latencies['trailing_stop'])}")

    # =========================================================================
    # 6. RL ENVIRONMENT SIMULATION
    # =========================================================================

    print_section("6. RL ENVIRONMENT SIMULATION", EMOJI_MAP['ROCKET'])

    print_subsection("Running 100 Random Steps")
    t0 = time.perf_counter()

    obs, info = rl_env.reset()
    total_reward = 0.0
    episode_length = 0

    for step in range(100):
        # Action is 3D array: [long_fraction, short_fraction, hold_fraction]
        # Random action: pick one of 3 discrete actions
        action_idx = np.random.randint(0, 3)
        if action_idx == 0:  # LONG
            action = np.array([0.1, 0.0, 0.0])
        elif action_idx == 1:  # SHORT
            action = np.array([0.0, 0.1, 0.0])
        else:  # HOLD
            action = np.array([0.0, 0.0, 1.0])

        obs, reward, terminated, truncated, info = rl_env.step(action)
        total_reward += reward
        episode_length += 1

        if terminated or truncated:
            obs, info = rl_env.reset()
            break

    t1 = time.perf_counter()
    latencies['rl_simulation'] = (t1 - t0) * 1000
    throughput = episode_length / ((t1 - t0) / 1000)

    print(f"✅ Simulation Complete:")
    print(f"  • Steps:            {episode_length}")
    print(f"  • Total Reward:     {total_reward:+.2f}")
    print(f"  • Avg Reward:       {total_reward/episode_length:+.3f}")
    print(f"  • Final Portfolio:  ${info.get('portfolio_value', 0):,.2f}")
    print(f"  • Throughput:       {throughput:,.0f} steps/sec")
    print(f"⏱️  Simulation: {format_latency(latencies['rl_simulation'])}")

    # =========================================================================
    # 7. LATENCY BREAKDOWN
    # =========================================================================

    print_section("7. LATENCY BREAKDOWN", EMOJI_MAP['CLOCK'])

    # Calculate pipeline latency (critical path)
    pipeline_latency = (
        latencies['feature_computation'] +
        latencies['narrative_computation'] +
        latencies['signal_computation'] +
        latencies['council_convene']
    )

    print("\n📊 COMPONENT LATENCIES:")
    print("-" * 80)
    for component, latency_ms in sorted(latencies.items(), key=lambda x: x[1], reverse=True):
        bar_length = int(latency_ms / max(latencies.values()) * 40)
        bar = '█' * bar_length
        print(f"  {component:25} {bar:40} {format_latency(latency_ms)}")

    print(f"\n⚡ CRITICAL PATH (Signal Pipeline):")
    print(f"  • Feature Computation:   {latencies['feature_computation']:.2f}ms")
    print(f"  • Narrative Computation: {latencies['narrative_computation']:.2f}ms")
    print(f"  • Signal Computation:    {latencies['signal_computation']:.2f}ms")
    print(f"  • Council Convene:       {latencies['council_convene']:.2f}ms")
    print(f"  • TOTAL PIPELINE:        {pipeline_latency:.2f}ms")

    # Check if under 100ms
    pipeline_ok = pipeline_latency < 100
    status_emoji = '✅' if pipeline_ok else '❌'
    print(f"\n{status_emoji} Pipeline Target: {'PASS' if pipeline_ok else 'FAIL'} "
          f"({pipeline_latency:.1f}ms / 100ms)")

    # =========================================================================
    # 8. FINAL VALIDATION
    # =========================================================================

    print_section("8. SYSTEM VALIDATION", EMOJI_MAP['SUCCESS'])

    checks = {
        'Feature Vector Valid': features.is_valid,
        'NVI Computed': narrative is not None,
        'Signal Generated': signal is not None,
        'Signal Tradeable': signal.tradeable,  # CORRECT FIELD NAME
        'Council Decision': decision is not None,
        'Council Votes': len(decision.votes) > 0,
        'Arbitrage Detected': arb.is_arb,
        'Trailing Stop Works': triggered3,
        'RL Environment OK': episode_length > 0,
        'Pipeline < 100ms': pipeline_ok,
    }

    print("\n✅ VALIDATION CHECKS:")
    print("-" * 80)
    all_pass = True
    for check, passed in checks.items():
        emoji = '✅' if passed else '❌'
        status = 'PASS' if passed else 'FAIL'
        print(f"  {emoji} {check:25} {status}")
        all_pass = all_pass and passed

    # =========================================================================
    # FINAL STATUS
    # =========================================================================

    print("\n" + "=" * 80)
    if all_pass:
        print("🎉  ALL SYSTEMS OPERATIONAL")
        print("=" * 80)
        print(f"\n✅ Black Edge V2 pipeline validated successfully!")
        print(f"✅ All {len(checks)} checks passed")
        print(f"✅ Pipeline latency: {pipeline_latency:.1f}ms (target: 100ms)")
        print(f"✅ Ready for production deployment")
    else:
        print("⚠️  SYSTEM VALIDATION FAILED")
        print("=" * 80)
        failed_checks = [k for k, v in checks.items() if not v]
        print(f"\n❌ {len(failed_checks)} checks failed:")
        for check in failed_checks:
            print(f"   • {check}")

    print("\n" + "=" * 80)

    return 0 if all_pass else 1


# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
