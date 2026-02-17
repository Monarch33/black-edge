#!/usr/bin/env python3
"""
Black Edge Dashboard — Real-time monitoring
============================================
Affiche en temps réel :
- News ingestion stats
- Crypto 5-min markets
- Active signals
- System health
"""

import asyncio
import time
from datetime import datetime
import httpx


BACKEND_URL = "http://localhost:8000"


async def fetch_data():
    """Fetch all dashboard data from backend."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            # Health check
            health_resp = await client.get(f"{BACKEND_URL}/api/v2/health")
            health = health_resp.json() if health_resp.status_code == 200 else {}

            # Crypto 5-min signals
            crypto_resp = await client.get(f"{BACKEND_URL}/api/v2/crypto/5min/signals")
            crypto = crypto_resp.json() if crypto_resp.status_code == 200 else {}

            # Opportunities
            opps_resp = await client.get(f"{BACKEND_URL}/api/opportunities")
            opportunities = opps_resp.json() if opps_resp.status_code == 200 else []

            return health, crypto, opportunities
        except Exception as e:
            return {}, {}, []


def format_time_remaining(seconds):
    """Format seconds as MM:SS."""
    if seconds < 0:
        return "EXPIRED"
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}:{secs:02d}"


def render_dashboard(health, crypto, opportunities):
    """Render the dashboard."""
    # Clear screen
    print("\033[2J\033[H")  # ANSI clear + move cursor to top

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print("╔" + "═" * 78 + "╗")
    print(f"║  🚀 BLACK EDGE V2 — REAL-TIME DASHBOARD{' ' * 36}║")
    print(f"║  {now}{' ' * 54}║")
    print("╠" + "═" * 78 + "╣")

    # System Health
    components = health.get("components", {})
    status_emoji = "✅" if health.get("status") == "healthy" else "⚠️"
    print(f"║  {status_emoji} SYSTEM HEALTH{' ' * 61}║")
    print("║" + " " * 78 + "║")

    comp_names = [
        ("News Collector", "news_collector"),
        ("Crypto 5-min Scanner", "crypto_5min_scanner"),
        ("Feature Engineer", "feature_engineer"),
        ("Quant Model", "quant_model"),
        ("The Council", "council"),
    ]

    for name, key in comp_names:
        is_healthy = components.get(key, False)
        emoji = "✅" if is_healthy else "❌"
        print(f"║    {emoji} {name:<40} {str(is_healthy):<30}║")

    print("╠" + "═" * 78 + "╣")

    # Crypto 5-min Markets
    markets = crypto.get("active_markets", [])
    signals = crypto.get("signals", [])
    btc_price = crypto.get("btcPrice", 0)

    print(f"║  ⚡ CRYPTO 5-MIN MARKETS (BTC: ${btc_price:,.2f}){' ' * 34}║")
    print("║" + " " * 78 + "║")

    if markets:
        for market in markets[:5]:  # Show top 5
            slug = market["slug"]
            interval = market["interval"]
            up_price = market["upPrice"]
            down_price = market["downPrice"]
            time_remaining = format_time_remaining(market["timeRemaining"])
            volume = market["volume"]

            # Determine if this market has a signal
            market_signal = next((s for s in signals if s["market"] == slug), None)
            signal_emoji = ""
            if market_signal:
                direction = market_signal["direction"]
                edge = market_signal["edge"]
                signal_emoji = f" 🔥 {direction} {edge:.1%} edge"

            line = f"  {interval}min: {slug[-10:]}  UP:{up_price:.2f} DN:{down_price:.2f}  ⏱{time_remaining}  💰${volume:,.0f}{signal_emoji}"
            print(f"║{line:<78}║")
    else:
        print(f"║  No active markets found{' ' * 54}║")

    print("╠" + "═" * 78 + "╣")

    # Polymarket Signals
    print(f"║  📊 TOP POLYMARKET SIGNALS{' ' * 51}║")
    print("║" + " " * 78 + "║")

    if opportunities:
        for opp in opportunities[:5]:  # Show top 5
            question = opp.get("question", "")[:45]
            edge = opp.get("edge", 0)
            volume = opp.get("volume", "")
            risk = opp.get("risk", "")

            emoji = "🟢" if edge > 5 else "🟡" if edge > 3 else "⚪"

            line = f"  {emoji} {question:<45} Edge:{edge:>3}% {volume:>8} {risk:>6}"
            print(f"║{line:<78}║")
    else:
        print(f"║  Loading signals...{' ' * 57}║")

    print("╚" + "═" * 78 + "╝")
    print()
    print("  Press Ctrl+C to exit | Updates every 2 seconds")
    print()


async def main():
    """Main dashboard loop."""
    print("Starting Black Edge Dashboard...")
    print("Connecting to backend at", BACKEND_URL)
    await asyncio.sleep(1)

    try:
        while True:
            health, crypto, opportunities = await fetch_data()
            render_dashboard(health, crypto, opportunities)
            await asyncio.sleep(2)
    except KeyboardInterrupt:
        print("\n\n👋 Dashboard stopped.")


if __name__ == "__main__":
    asyncio.run(main())
