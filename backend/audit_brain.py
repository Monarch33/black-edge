#!/usr/bin/env python3
"""
BLACK EDGE INTELLIGENCE AUDIT
==============================
Live market stress test to prove the quant engine finds real edges.

Fetches LIVE data from Polymarket Gamma API and runs full quant analysis:
- Kelly Criterion for optimal bet sizing
- Implied Probability vs Market Price
- Arbitrage detection (YES + NO price inconsistencies)
- Volatility analysis
- Composite signal strength scoring

Outputs a clean report showing the TOP 3 OPPORTUNITIES detected right now.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

import structlog
from engine.polymarket import PolymarketClient
from engine.analytics import QuantEngine

logger = structlog.get_logger()


# =============================================================================
# Configuration
# =============================================================================

# Fetch top 50 active markets with volume > $10k
MAX_MARKETS = 50

# Minimum volume threshold (already enforced in PolymarketClient)
MIN_VOLUME_USD = 10_000


# =============================================================================
# Formatting Utilities
# =============================================================================

def format_currency(amount: float) -> str:
    """Format dollar amounts for display."""
    if amount >= 1_000_000:
        return f"${amount / 1_000_000:.2f}M"
    if amount >= 1_000:
        return f"${amount / 1_000:.1f}K"
    return f"${amount:.0f}"


def format_percentage(value: float) -> str:
    """Format decimal as percentage."""
    return f"{value * 100:.1f}%"


def get_recommendation(edge: float, signal_strength: int, arb_flag: bool, risk: str) -> str:
    """
    Determine trading recommendation based on quant metrics.

    AGGRESSIVE TUNING - Lower thresholds to capture more opportunities:
    STRONG BUY: Edge >3%, signal >60, low risk
    BUY: Edge >1%, signal >40
    HOLD: Edge >0%, signal >30
    AVOID: Negative edge or very high risk
    """
    if arb_flag:
        return "🚨 ARBITRAGE - STRONG BUY"

    # STRONG BUY: Solid edge + good signal + low risk
    if edge > 0.03 and signal_strength > 60 and risk == "low":
        return "💎 STRONG BUY"

    # BUY: Decent edge + reasonable signal (lowered thresholds)
    if edge > 0.01 and signal_strength > 40:
        return "✅ BUY"

    # HOLD: Small edge or medium signal (worth monitoring)
    if edge > 0 and signal_strength > 30 and risk != "high":
        return "⚠️  HOLD"

    # SPECULATIVE: Edge present but low confidence
    if edge > 0 and risk != "high":
        return "🔍 SPECULATIVE"

    return "❌ AVOID"


def print_separator():
    """Print a visual separator."""
    print("=" * 100)


def print_header(text: str):
    """Print a section header."""
    print()
    print_separator()
    print(f"  {text}")
    print_separator()


# =============================================================================
# Main Audit Function
# =============================================================================

async def audit_intelligence():
    """
    Run the intelligence audit.

    1. Fetch LIVE markets from Polymarket
    2. Run quant analysis (Kelly, Arb, Volatility)
    3. Display TOP 3 OPPORTUNITIES
    """
    print()
    print("╔" + "=" * 98 + "╗")
    print("║" + " " * 30 + "BLACK EDGE INTELLIGENCE AUDIT" + " " * 39 + "║")
    print("║" + " " * 20 + "LIVE MARKET STRESS TEST - PROVING THE ALPHA" + " " * 35 + "║")
    print("╚" + "=" * 98 + "╝")
    print()

    # Initialize clients
    print("🔧 Initializing Polymarket client...")
    polymarket_client = PolymarketClient()

    print("🔧 Initializing Quant Engine (Kelly, Arb, Volatility analyzers)...")
    quant_engine = QuantEngine()

    # Fetch live markets
    print_header(f"📡 FETCHING LIVE DATA FROM POLYMARKET (Top {MAX_MARKETS} markets by volume)")

    try:
        markets = await polymarket_client.fetch_markets(max_markets=MAX_MARKETS)

        if not markets:
            print("❌ ERROR: No markets returned from Polymarket API")
            print("   This could indicate:")
            print("   - API rate limiting")
            print("   - Network connectivity issues")
            print("   - All markets below minimum volume threshold")
            return

        print(f"✅ Successfully fetched {len(markets)} active markets")
        print(f"   Total 24h volume: {format_currency(sum(m.volume_24h for m in markets))}")
        print(f"   Average liquidity: {format_currency(sum(m.liquidity for m in markets) / len(markets))}")

    except Exception as e:
        print(f"❌ CRITICAL ERROR fetching markets: {e}")
        return

    # Run quant analysis
    print_header("🧮 RUNNING QUANTITATIVE ANALYSIS")
    print("   - Calculating Kelly Criterion for optimal bet sizing")
    print("   - Computing implied probabilities vs market prices")
    print("   - Detecting arbitrage opportunities (YES + NO price inconsistencies)")
    print("   - Analyzing price volatility (1-hour window)")
    print("   - Scoring composite signal strength (0-100)")
    print()

    try:
        signals = quant_engine.analyze(markets)

        if not signals:
            print("⚠️  WARNING: No signals generated from analysis")
            return

        print(f"✅ Generated {len(signals)} quantitative signals")
        print(f"   Top signal strength: {signals[0].signal_strength}/100")
        print(f"   Arbitrage opportunities detected: {sum(1 for s in signals if s.arb_flag)}")

    except Exception as e:
        print(f"❌ CRITICAL ERROR running analysis: {e}")
        import traceback
        traceback.print_exc()
        return

    # Display TOP 3 OPPORTUNITIES
    print_header("🎯 TOP 3 OPPORTUNITIES DETECTED RIGHT NOW")
    print()

    top_signals = signals[:3]

    for rank, signal in enumerate(top_signals, 1):
        print(f"┌─ OPPORTUNITY #{rank} " + "─" * 82 + "┐")
        print(f"│")
        print(f"│  MARKET:          {signal.question[:70]}")
        print(f"│  PLATFORM:        {signal.platform}")
        print(f"│")
        print(f"│  ──── PRICING ────")
        print(f"│  Market Price:    {format_percentage(signal.yes_price)}")
        print(f"│  Fair Value:      {format_percentage(signal.yes_price + signal.kelly_edge)}")
        print(f"│  EDGE:            {'+' if signal.kelly_edge > 0 else ''}{format_percentage(signal.kelly_edge)}  {'🟢' if signal.kelly_edge > 0 else '🔴'}")
        print(f"│")
        print(f"│  ──── LIQUIDITY ────")
        print(f"│  Volume (24h):    {format_currency(signal.volume_24h)}")
        print(f"│  Volume (Total):  {format_currency(signal.volume_total)}")
        print(f"│  Liquidity:       {format_currency(signal.liquidity)}")
        print(f"│")
        print(f"│  ──── QUANT METRICS ────")
        print(f"│  Kelly Fraction:  {signal.kelly_fraction:.4f} (bet this % of bankroll)")
        print(f"│  Volatility (1h): {signal.volatility_1h:.4f}")
        print(f"│  Spread:          {signal.spread:.4f}")
        print(f"│  Trend:           {signal.trend.upper()}")
        print(f"│  Risk Level:      {signal.risk.upper()}")
        print(f"│")
        print(f"│  ──── ARBITRAGE ────")
        if signal.arb_flag:
            print(f"│  🚨 ARBITRAGE DETECTED!")
            print(f"│  Details:         {signal.arb_detail[:60]}")
        else:
            print(f"│  No arbitrage detected")
        print(f"│")
        print(f"│  ──── SIGNAL ────")
        print(f"│  Signal Strength: {signal.signal_strength}/100  {'█' * (signal.signal_strength // 5)}")
        print(f"│")
        recommendation = get_recommendation(
            signal.kelly_edge,
            signal.signal_strength,
            signal.arb_flag,
            signal.risk,
        )
        print(f"│  RECOMMENDATION:  {recommendation}")
        print(f"│")
        print(f"│  URL:             {signal.url}")
        print(f"└" + "─" * 98 + "┘")
        print()

    # Summary statistics
    print_header("📊 PORTFOLIO SUMMARY")
    print()

    positive_edge_signals = [s for s in signals if s.kelly_edge > 0]
    arb_signals = [s for s in signals if s.arb_flag]

    print(f"  Total Markets Analyzed:        {len(markets)}")
    print(f"  Signals Generated:             {len(signals)}")
    print(f"  Positive Edge Opportunities:   {len(positive_edge_signals)} ({len(positive_edge_signals)/len(signals)*100:.1f}%)")
    print(f"  Arbitrage Opportunities:       {len(arb_signals)}")
    print(f"  Average Edge (Positive Only):  {format_percentage(sum(s.kelly_edge for s in positive_edge_signals) / len(positive_edge_signals)) if positive_edge_signals else '0.0%'}")
    print(f"  Average Signal Strength:       {sum(s.signal_strength for s in signals) / len(signals):.1f}/100")
    print()

    if len(positive_edge_signals) > 0:
        print("  ✅ MODEL IS ACTIVE - Multiple positive edge opportunities detected")
    else:
        print("  ⚠️  MODEL IS PASSIVE - No clear opportunities at this time")

    print()
    print_separator()
    print()

    # Cleanup
    await polymarket_client.close()


# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    try:
        asyncio.run(audit_intelligence())
    except KeyboardInterrupt:
        print("\n\n⚠️  Audit interrupted by user")
    except Exception as e:
        print(f"\n\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
