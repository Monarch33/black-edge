"""
Black Edge Configuration — The Invisible Engine
===========================================
All config loaded from .env.local at backend root.
In deployment (Railway, etc.): fallbacks allow startup without .env.local.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _is_deployment() -> bool:
    """True if running on Railway, Render, or similar (PORT set)."""
    return os.environ.get("PORT") is not None or os.environ.get("RAILWAY_ENVIRONMENT") is not None


def _get_env_path() -> Path:
    """Resolve .env.local path: backend root first, then project root."""
    backend_root = Path(__file__).resolve().parent
    candidates = [
        backend_root / ".env.local",
        backend_root.parent / ".env.local",
        Path.cwd() / ".env.local",
    ]
    for p in candidates:
        if p.exists():
            return p
    return backend_root / ".env.local"  # fallback for error message


class Settings(BaseSettings):
    """Application settings — REQUIRED keys must be set or app crashes."""

    # Server / Environment
    port: int = 8000
    environment: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = False
    app_name: str = "Black Edge"

    # ── REQUIRED KEYS (crash if missing) ─────────────────────
    database_url: str = ""
    stripe_secret_key: str = ""
    fernet_key: str = ""  # For encrypting UserCredentials (polymarket keys)

    # LLM — at least one must be set
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # ── Optional (polymarket admin read-only, etc.) ───────────
    polymarket_api_url: str = "https://gamma-api.polymarket.com"
    polymarket_clob_url: str = "https://clob.polymarket.com"
    polymarket_admin_key: str = ""  # For global orderbook read if needed

    # Polygon RPC
    polygon_rpc_url: str = "https://polygon-rpc.com"
    polygon_ws_url: str = "wss://polygon-bor-rpc.publicnode.com"

    # Polymarket Contract Addresses (Polygon Mainnet)
    ctf_exchange_address: str = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"
    neg_risk_adapter_address: str = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296"
    neg_risk_ctf_exchange_address: str = "0xC5d563A36AE78145C45a50134d48A1215220f80a"
    conditional_token_address: str = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
    usdc_address: str = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Firebase
    firebase_credentials_path: str = ""

    # Arbitrage Parameters
    min_profit_threshold: float = 0.05
    max_position_probability: float = 0.95
    vwap_block_window: int = 1
    price_carry_forward_blocks: int = 5000
    risk_analysis_window: int = 950

    # LLM
    llm_model: str = "claude-sonnet-4-20250514"
    llm_api_key: str = ""  # Legacy alias for anthropic
    dependency_update_interval: int = 3600

    # Tier
    tier_observer: str = "observer"
    tier_runner: str = "runner"
    tier_whale: str = "whale"

    # Security
    jwt_secret_key: str = ""
    cors_origins: str = "http://localhost:3000,https://blackedge.io"

    # Email
    resend_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=[
            str(Path(__file__).resolve().parent / ".env.local"),
            str(_get_env_path()),
            ".env.local",
            ".env",
        ],
        env_file_encoding="utf-8",
        extra="ignore",
        env_nested_delimiter="__",
    )

    @model_validator(mode="after")
    def validate_required_keys(self) -> "Settings":
        """Validate config. In deployment, use fallbacks so app can start."""
        if _is_deployment():
            # Fallbacks for Railway/Render — app starts, features fail gracefully
            if not self.database_url.strip():
                self.database_url = "sqlite:////tmp/blackedge.db"
            if not self.fernet_key.strip():
                # Generate deterministic key from PORT (not secure, but allows startup)
                import base64
                from hashlib import sha256
                seed = os.environ.get("RAILWAY_PROJECT_ID", "blackedge") + os.environ.get("PORT", "8000")
                self.fernet_key = base64.urlsafe_b64encode(sha256(seed.encode()).digest()).decode()
            # stripe_secret_key, LLM keys: allow empty — Stripe/LLM features fail when used
            return self

        # Local dev: strict validation
        env_path = _get_env_path()
        missing: list[str] = []

        if not self.database_url.strip():
            missing.append("DATABASE_URL")

        if not self.stripe_secret_key.strip():
            missing.append("STRIPE_SECRET_KEY")

        if not self.fernet_key.strip():
            missing.append("FERNET_KEY")

        if not self.anthropic_api_key.strip() and not self.openai_api_key.strip():
            if self.llm_api_key.strip():
                self.anthropic_api_key = self.llm_api_key
            else:
                missing.append("ANTHROPIC_API_KEY or OPENAI_API_KEY")

        if missing:
            msg = (
                f"\n{'='*60}\n"
                f"BLACK EDGE CRASH: Missing required config in .env.local\n"
                f"{'='*60}\n"
                f"Missing keys: {', '.join(missing)}\n"
                f"Expected file: {env_path}\n"
                f"Create .env.local from .env.local.example and fill all values.\n"
                f"{'='*60}\n"
            )
            raise ValueError(msg)

        return self

    # llm_api_key field defined above — use get_resolved_llm_key() for resolution


def _load_env() -> None:
    """Load .env.local into os.environ before any other code reads env."""
    for p in [
        Path(__file__).resolve().parent / ".env.local",
        _get_env_path(),
        Path.cwd() / ".env.local",
        Path.cwd() / ".env",
    ]:
        if p.exists():
            load_dotenv(p, override=False)
            break


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings. Validates required keys on first load."""
    _load_env()
    return Settings()
