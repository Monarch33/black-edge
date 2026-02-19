"""
Configuration centralisée Black Edge
====================================
Variables d'environnement, seuils, paramètres.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class BlackEdgeSettings(BaseSettings):
    """Configuration chargée depuis .env ou variables d'environnement."""

    model_config = SettingsConfigDict(
        env_prefix="BLACKEDGE_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # API Polymarket
    polymarket_gamma_url: str = "https://gamma-api.polymarket.com"
    polymarket_clob_url: str = "https://clob.polymarket.com"

    # Filtres marchés
    min_volume_usd: float = 25_000.0
    min_liquidity: float = 5_000.0

    # LLM
    llm_provider: str = "anthropic"  # anthropic | openai
    llm_model: str = "claude-3-5-sonnet-20241022"  # ou gpt-4o pour OpenAI
    llm_api_key: str = ""

    # Alpha (décalage Probabilité IA vs Marché)
    alpha_threshold_pct: float = 10.0  # % minimum pour signal

    # Risk (Kelly)
    kelly_fraction: float = 0.5  # Fractional Kelly
    max_position_pct: float = 5.0  # Max 5% du portfolio par trade

    # Base de données locale
    db_path: str = "blackedge_local.db"

    # Paper Trading
    paper_portfolio_usd: float = 10_000.0

    # Mode réel (live trading sur Polygon)
    # Quand True : exécution réelle via backend /api/build-tx
    real_trading_enabled: bool = False
