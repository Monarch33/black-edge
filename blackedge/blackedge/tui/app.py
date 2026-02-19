"""
Application Textual — Dashboard Black Edge
==========================================
3 panneaux : Live Feed (haut), Console Logs (bas gauche), Portfolio (bas droite).
Style cyberpunk / institutionnel.
"""

import asyncio
from datetime import datetime

from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import DataTable, Footer, Header, RichLog, Static

from blackedge.config import BlackEdgeSettings
from blackedge.core.orchestrator import Orchestrator
from blackedge.engine.paper_trader import PaperTrader


class LiveFeed(Static):
    """Ticker des marchés en cours d'analyse."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._current = ""
        self._index = 0
        self._total = 0

    def update_market(self, question: str, index: int, total: int) -> None:
        self._current = question[:70] + ("..." if len(question) > 70 else "")
        self._index = index
        self._total = total
        self.update(
            f"[bold cyan]▶ ANALYSE [{index}/{total}][/]\n"
            f"[dim]{self._current}[/]"
        )


class ConsoleLogs(RichLog):
    """Logs système style Matrix (vert)."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.highlighter = None

    def add_log(self, msg: str, level: str = "info") -> None:
        ts = datetime.now().strftime("%H:%M:%S")
        if level == "alpha":
            styled = f"[green]{ts}[/] [bold green]◉ ALPHA[/] {msg}"
        elif level == "trade":
            styled = f"[green]{ts}[/] [bold yellow]◆ TRADE[/] {msg}"
        elif level == "warn":
            styled = f"[green]{ts}[/] [yellow]⚠[/] {msg}"
        else:
            styled = f"[green]{ts}[/] {msg}"
        self.write_line(styled)


class PortfolioPanel(Container):
    """Tableau des positions et PnL."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._table: DataTable | None = None

    def compose(self) -> ComposeResult:
        self._table = DataTable(
            cursor_type="row",
            zebra_stripes=True,
            header_height=1,
        )
        self._table.add_columns("ID", "Marché", "Side", "Size", "Prix", "Status")
        yield self._table
        yield Static("", id="pnl-summary")

    def refresh_positions(self) -> None:
        trader = PaperTrader(BlackEdgeSettings())
        trades = trader.get_open_positions()
        pnl = trader.get_total_pnl()

        if self._table:
            self._table.clear()
            self._table.add_columns("ID", "Marché", "Side", "Size", "Prix", "Status")
            for t in trades:
                self._table.add_row(
                    str(t.id),
                    (t.market_question[:30] + "...") if len(t.market_question) > 30 else t.market_question,
                    t.side,
                    f"${t.size_usd:,.0f}",
                    f"{t.expected_price:.2%}",
                    t.status,
                )

        try:
            summary = self.query_one("#pnl-summary", Static)
            color = "green" if pnl >= 0 else "red"
            summary.update(f"[bold {color}]PnL Total: ${pnl:,.2f}[/]")
        except Exception:
            pass


class BlackEdgeApp(App):
    """Application principale Black Edge."""

    CSS = """
    Screen {
        layout: vertical;
        background: #0a0e14;
    }

    Header {
        background: #1a2332;
        color: #00ff88;
        dock: top;
        height: 1;
    }

    #main {
        layout: vertical;
        height: 1fr;
        padding: 1;
    }

    #live-feed {
        height: 4;
        border: solid #00ff88;
        padding: 1 2;
        background: #0d1117;
        color: #00ff88;
    }

    #bottom-panels {
        layout: horizontal;
        height: 1fr;
        margin-top: 1;
    }

    #logs-panel {
        width: 1fr;
        border: solid #00ff88;
        padding: 1;
        background: #0d1117;
        margin-right: 1;
    }

    #portfolio-panel {
        width: 1fr;
        border: solid #00ff88;
        padding: 1;
        background: #0d1117;
    }

    RichLog {
        height: 100%;
        scrollbar-background: #1a2332;
        scrollbar-color: #00ff88;
        color: #00ff88;
    }

    DataTable {
        height: 1fr;
        background: #0d1117;
    }

    DataTable > .datatable--header {
        background: #1a2332;
        color: #00ff88;
    }

    DataTable > .datatable--cursor {
        background: #1a2332;
    }

    Footer {
        background: #1a2332;
        color: #00ff88;
    }
    """

    TITLE = "BLACK EDGE"
    SUB_TITLE = "Autonomous Prediction Market Bot — Paper Trading"
    BINDINGS = [("q", "quit", "Quitter")]

    def __init__(self, settings: BlackEdgeSettings | None = None) -> None:
        super().__init__()
        self._settings = settings or BlackEdgeSettings()
        self._orchestrator: Orchestrator | None = None
        self._worker: Worker | None = None

    def compose(self) -> ComposeResult:
        yield Header()
        with Container(id="main"):
            yield LiveFeed("", id="live-feed")
            with Horizontal(id="bottom-panels"):
                with Vertical(id="logs-panel"):
                    yield Static("[bold]CONSOLE LOGS[/]", id="logs-title")
                    yield ConsoleLogs(id="console-logs")
                with Vertical(id="portfolio-panel"):
                    yield Static("[bold]PORTFOLIO / LEDGER[/]", id="portfolio-title")
                    yield PortfolioPanel(id="portfolio-widget")
        yield Footer()

    def on_mount(self) -> None:
        def safe_cb(method: str, *args, **kwargs) -> None:
            m = getattr(self, method)
            try:
                self.call_from_thread(m, *args, **kwargs)
            except Exception:
                pass

        self._orchestrator = Orchestrator(
            settings=self._settings,
            on_market_analyzing=lambda q, i, t: safe_cb("_on_market", q, i, t),
            on_alpha=lambda a: safe_cb("_on_alpha", a),
            on_trade=lambda tid, a, s, p: safe_cb("_on_trade", tid, a, s, p),
            on_log=lambda msg, lvl="info": safe_cb("_on_log", msg, lvl),
        )
        self.run_worker(self._run_orchestrator, exclusive=False)

    async def _run_orchestrator(self) -> None:
        try:
            await self._orchestrator.run()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self._on_log(f"Erreur: {e}", "warn")

    def _on_market(self, question: str, index: int, total: int) -> None:
        feed = self.query_one("#live-feed", LiveFeed)
        feed.update_market(question, index, total)

    def _on_alpha(self, alpha) -> None:
        logs = self.query_one("#console-logs", ConsoleLogs)
        logs.add_log(
            f"Alpha {alpha.alpha_pct:.1f}% | {alpha.market_question[:50]}...",
            "alpha",
        )

    def _on_trade(self, trade_id: int, alpha, size: float, price: float) -> None:
        logs = self.query_one("#console-logs", ConsoleLogs)
        logs.add_log(f"Trade #{trade_id} | {alpha.side} ${size:,.0f} @ {price:.2%}", "trade")
        panel = self.query_one("#portfolio-widget", PortfolioPanel)
        panel.refresh_positions()

    def _on_log(self, msg: str, level: str = "info") -> None:
        try:
            logs = self.query_one("#console-logs", ConsoleLogs)
            logs.add_log(msg, level)
        except Exception:
            pass
