"""Centralized configuration via pydantic-settings."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


_APP_DIR = Path.home() / ".blackedge"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BE_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # ── License ──────────────────────────────────────────────
    license_key: str = ""
    api_base_url: str = Field(
        default="http://localhost:8000",
        description="Backend API URL for license verification.",
    )

    # ── Polymarket ───────────────────────────────────────────
    polymarket_base_url: str = "https://gamma-api.polymarket.com"
    polymarket_clob_url: str = "https://clob.polymarket.com"
    min_volume_usd: float = 25_000.0
    min_liquidity_usd: float = 5_000.0

    # ── LLM ──────────────────────────────────────────────────
    llm_provider: str = "anthropic"  # "anthropic" | "openai"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    llm_model: str = "claude-sonnet-4-20250514"
    llm_temperature: float = 0.1

    # ── Edge Detection ───────────────────────────────────────
    min_edge_pct: float = Field(
        default=8.0,
        description="Minimum divergence (%) between IA probability and market price to trigger a signal.",
    )

    # ── Risk Management ──────────────────────────────────────
    kelly_fraction: float = Field(
        default=0.25,
        description="Fractional Kelly multiplier (0.25 = quarter-Kelly for safety).",
    )
    max_position_pct: float = Field(
        default=5.0,
        description="Maximum % of portfolio allowed on a single trade.",
    )
    initial_bankroll: float = 1_000.0

    # ── Database ─────────────────────────────────────────────
    db_path: Path = _APP_DIR / "blackedge_local.db"

    # ── General ──────────────────────────────────────────────
    data_dir: Path = _APP_DIR
    log_level: str = "INFO"
    scan_interval_seconds: int = 60


def get_settings() -> Settings:
    """Singleton-ish factory — import this everywhere."""
    return Settings()
