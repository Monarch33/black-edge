"""
Paper Trader — Execution Engine (Le Sniper)
===========================================
Simulation ordres, enregistrement SQLite. Mode Paper Trading uniquement.
"""

from blackedge.config import BlackEdgeSettings
from blackedge.engine.db import TradeDB
from blackedge.intelligence.schemas import AlphaSignal


class PaperTrader:
    """
    Simule l'exécution des trades sans envoi sur Polygon.
    Enregistre dans blackedge_local.db.
    """

    def __init__(self, settings: BlackEdgeSettings | None = None) -> None:
        self._settings = settings or BlackEdgeSettings()
        self._db = TradeDB(self._settings)

    def execute(
        self,
        signal: AlphaSignal,
        size_usd: float,
        expected_price: float,
    ) -> int | None:
        """
        Simule un ordre et l'enregistre.

        Args:
            signal: Signal Alpha
            size_usd: Montant en USD
            expected_price: Prix attendu (YES ou NO selon side)

        Returns:
            ID du trade ou None si erreur.
        """
        if size_usd <= 0:
            return None

        try:
            trade_id = self._db.insert_trade(
                market_id=signal.market_id,
                market_question=signal.market_question[:512],
                side=signal.side,
                size_usd=size_usd,
                expected_price=expected_price,
                status="PAPER_OPEN",
                pnl=0.0,
                notes=f"Alpha={signal.alpha_pct:.1f}% Conf={signal.confidence_score:.2f}",
            )
            return trade_id
        except Exception:
            return None

    def close_trade(self, trade_id: int, pnl: float) -> None:
        """Clôture un trade paper avec PnL."""
        self._db.update_trade(trade_id, status="PAPER_CLOSED", pnl=pnl)

    def get_open_positions(self) -> list:
        return self._db.get_open_trades()

    def get_total_pnl(self) -> float:
        return self._db.get_total_pnl()
