"""
Orchestrateur — Boucle principale du bot
========================================
Fetch marchés → Analyse IA → Alpha → Kelly → Paper Trade.
"""

import asyncio
import structlog

from blackedge.api.polymarket_client import PolymarketClient
from blackedge.config import BlackEdgeSettings
from blackedge.engine.paper_trader import PaperTrader
from blackedge.intelligence.agent import LLMAgent
from blackedge.risk.kelly import position_size_usd

logger = structlog.get_logger()


class Orchestrator:
    """
    Boucle principale asynchrone.
    Callbacks pour mise à jour TUI : on_market_analyzing, on_alpha, on_trade, on_log.
    """

    def __init__(
        self,
        settings: BlackEdgeSettings | None = None,
        on_market_analyzing: callable | None = None,
        on_alpha: callable | None = None,
        on_trade: callable | None = None,
        on_log: callable | None = None,
    ) -> None:
        self._settings = settings or BlackEdgeSettings()
        self._on_market = on_market_analyzing
        self._on_alpha = on_alpha
        self._on_trade = on_trade
        self._on_log = on_log
        self._running = False
        self._markets_per_cycle = 5
        self._cycle_interval_sec = 60

    def _log(self, msg: str, level: str = "info") -> None:
        logger.info("orchestrator", message=msg)
        if self._on_log:
            self._on_log(msg, level)

    async def run(self) -> None:
        """Boucle principale (cycle infini jusqu'à stop())."""
        self._running = True
        client = PolymarketClient(self._settings)
        agent = LLMAgent(self._settings)
        trader = PaperTrader(self._settings)
        portfolio = self._settings.paper_portfolio_usd

        if not self._settings.llm_api_key:
            self._log(
                "⚠ BLACKEDGE_LLM_API_KEY non défini. Définir dans .env pour l'analyse IA.",
                "warn",
            )

        try:
            while self._running:
                self._log("Black Edge — Démarrage du cycle", "info")
                markets = await client.fetch_markets(max_markets=20)

                if not markets:
                    self._log("Aucun marché récupéré. Vérifiez la connexion.", "warn")
                    await asyncio.sleep(self._cycle_interval_sec)
                    continue

                self._log(f"Marchés chargés: {len(markets)}", "info")

                for i, market in enumerate(markets[: self._markets_per_cycle]):
                    if not self._running:
                        break

                    if self._on_market:
                        self._on_market(market.question, i + 1, len(markets))

                    analysis = await agent.analyze_market(market)
                    if not analysis:
                        self._log(f"Analyse IA échouée: {market.question[:40]}...", "warn")
                        continue

                    alpha = agent.compute_alpha(market, analysis)
                    if not alpha:
                        continue

                    self._log(
                        f"ALPHA {alpha.alpha_pct:.1f}% | {market.question[:50]}... | "
                        f"IA={alpha.ia_probability:.1%} vs Marché={alpha.market_probability:.1%}",
                        "alpha",
                    )
                    if self._on_alpha:
                        self._on_alpha(alpha)

                    price = market.yes_price if alpha.side == "YES" else market.no_price
                    size = position_size_usd(
                        portfolio_usd=portfolio,
                        win_prob=alpha.ia_probability if alpha.side == "YES" else (1 - alpha.ia_probability),
                        price=price,
                        side=alpha.side,
                        settings=self._settings,
                    )

                    if size > 0:
                        trade_id = trader.execute(alpha, size, price)
                        if trade_id:
                            self._log(
                                f"PAPER TRADE #{trade_id} | {alpha.side} ${size:,.0f} @ {price:.2%}",
                                "trade",
                            )
                            if self._on_trade:
                                self._on_trade(trade_id, alpha, size, price)

                    await asyncio.sleep(2)

                self._log(
                    f"Cycle terminé. PnL: ${trader.get_total_pnl():,.2f}",
                    "info",
                )
                self._log(
                    f"Prochain cycle dans {self._cycle_interval_sec}s...",
                    "info",
                )
                await asyncio.sleep(self._cycle_interval_sec)
        finally:
            await client.close()
            await agent.close()
            self._running = False

    def stop(self) -> None:
        self._running = False
