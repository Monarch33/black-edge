"""Typer CLI — the single entry-point users interact with."""

from __future__ import annotations

from typing import Optional

import typer
from rich.console import Console

from blackedge import __app_name__, __version__
from blackedge.license import enforce_license

app = typer.Typer(
    name="blackedge",
    help="Black Edge — Autonomous Prediction-Market Trading Bot",
    no_args_is_help=True,
    rich_markup_mode="rich",
)
console = Console()


def _version_callback(value: bool) -> None:
    if value:
        console.print(f"[bold cyan]{__app_name__}[/] v{__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: Optional[bool] = typer.Option(  # noqa: UP007
        None,
        "--version",
        "-v",
        help="Show version and exit.",
        callback=_version_callback,
        is_eager=True,
    ),
) -> None:
    """Black Edge CLI root."""


@app.command()
def start(
    key: str = typer.Option(
        ...,
        "--key",
        "-k",
        help="Your Black Edge license key (starts with BE-).",
        prompt="License key",
    ),
    paper: bool = typer.Option(
        True,
        "--paper/--live",
        help="Run in paper-trading mode (default: paper).",
    ),
) -> None:
    """Launch the Black Edge trading terminal."""
    import asyncio

    from blackedge.config import get_settings

    enforce_license(key)

    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)

    console.print(
        f"\n[bold black on white]  ⬛ BLACK EDGE  [/]  "
        f"v{__version__}  •  {'PAPER' if paper else 'LIVE'} mode\n"
    )

    # TUI will be wired here in Step 4.
    # For now, just confirm the event loop boots cleanly.
    async def _boot() -> None:
        console.print("[dim]Event loop ready. Awaiting TUI integration (Step 4).[/dim]")

    asyncio.run(_boot())


@app.command()
def status() -> None:
    """Show bot health & last known portfolio state."""
    console.print("[yellow]status command — not yet implemented.[/]")
