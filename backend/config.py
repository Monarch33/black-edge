"""
Black Edge Configuration
========================
Central configuration for the arbitrage engine.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server / Environment
    port: int = 8000
    environment: str = "development"

    # API Configuration
    app_name: str = "Black Edge"
    debug: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # External API Keys
    llm_api_key: str = ""
    stripe_secret_key: str = ""

    # Polygon RPC Configuration
    polygon_rpc_url: str = "https://polygon-rpc.com"
    polygon_ws_url: str = "wss://polygon-bor-rpc.publicnode.com"

    # Polymarket Contract Addresses (Polygon Mainnet)
    ctf_exchange_address: str = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"
    neg_risk_adapter_address: str = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296"
    neg_risk_ctf_exchange_address: str = "0xC5d563A36AE78145C45a50134d48A1215220f80a"
    conditional_token_address: str = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
    usdc_address: str = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

    # Redis Configuration
    redis_url: str = "redis://localhost:6379"

    # Firebase Configuration
    firebase_credentials_path: str = ""

    # Arbitrage Parameters
    min_profit_threshold: float = 0.05  # Minimum $0.05 profit to consider
    max_position_probability: float = 0.95  # Ignore positions with >95% probability
    vwap_block_window: int = 1  # Blocks for VWAP calculation
    price_carry_forward_blocks: int = 5000  # ~2.5 hours on Polygon
    risk_analysis_window: int = 950  # ~1 hour for slippage estimation

    # LLM Configuration (for Dependency Agent)
    llm_model: str = "deepseek-r1-distill-qwen-32b"
    dependency_update_interval: int = 3600  # Update dependencies every hour

    # Tier Configuration
    tier_observer: str = "observer"
    tier_runner: str = "runner"
    tier_whale: str = "whale"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
