"""
CLI Black Edge — Typer
======================
Commandes : blackedge start --key=XYZ, blackedge markets
"""

import asyncio

import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(
    name="blackedge",
    help="Black Edge — Bot de Trading Autonome pour Marchés Prédictifs",
    no_args_is_help=True,
)


@app.command()
def start(
    key: str = typer.Argument(..., help="Clé de licence (BE-xxx)"),
) -> None:
    """Lance le bot en mode Paper Trading."""
    from blackedge.license import verify_license

    if not verify_license(key):
        typer.echo("❌ Licence invalide. Le terminal va se fermer.")
        raise typer.Exit(code=1)

    typer.echo("✅ Licence validée. Démarrage du bot...")
    from blackedge.tui.app import BlackEdgeApp

    app = BlackEdgeApp()
    app.run()


@app.command()
def version() -> None:
    """Affiche la version."""
    from blackedge import __version__

    typer.echo(f"Black Edge v{__version__}")


@app.command()
def markets(
    count: int = typer.Option(5, "--count", "-n", help="Nombre de marchés à afficher"),
) -> None:
    """Test ÉTAPE 2 : Affiche les marchés Polymarket filtrés (volume ≥ 25k$)."""
    from blackedge.api.polymarket_client import PolymarketClient

    async def _run() -> None:
        client = PolymarketClient()
        try:
            markets_list = await client.fetch_markets(max_markets=count)
        finally:
            await client.close()

        if not markets_list:
            typer.echo("❌ Aucun marché récupéré. Vérifiez la connexion.")
            raise typer.Exit(1)

        table = Table(
            title="[bold cyan]Black Edge — Marchés Polymarket (filtrés)[/]",
            show_header=True,
            header_style="bold magenta",
        )
        table.add_column("#", style="dim", width=3)
        table.add_column("Question", style="cyan", max_width=50, overflow="fold")
        table.add_column("YES %", justify="right", style="green")
        table.add_column("NO %", justify="right", style="red")
        table.add_column("Spread", justify="right")
        table.add_column("Vol 24h", justify="right", style="yellow")
        table.add_column("Liquidité", justify="right")

        for i, m in enumerate(markets_list, 1):
            table.add_row(
                str(i),
                m.question[:50] + ("..." if len(m.question) > 50 else ""),
                f"{m.yes_price:.1%}",
                f"{m.no_price:.1%}",
                f"{m.spread:.2%}",
                f"${m.volume_24h:,.0f}",
                f"${m.liquidity:,.0f}",
            )

        console = Console()
        console.print(table)
        console.print(f"\n[dim]✅ {len(markets_list)} marché(s) affiché(s) — Volume ≥ 25k$, Liquidité ≥ 5k$[/]")

    asyncio.run(_run())
