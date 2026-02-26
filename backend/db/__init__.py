"""
Black Edge Database Layer — The Invisible Engine
================================================
User, UserCredentials (encrypted), BotInstance, TradeLogs, License.
"""

from .credentials import get_polymarket_credentials_decrypted, save_polymarket_credentials
from .encryption import decrypt_credential, encrypt_credential, generate_fernet_key
from .models import (
    Base,
    BotInstance,
    BotStatus,
    License,
    LicenseStatus,
    LicenseTier,
    TradeLog,
    User,
    UserCredentials,
    UserTier,
    init_db,
)
from .session import get_engine, get_session

__all__ = [
    "Base",
    "BotInstance",
    "BotStatus",
    "License",
    "LicenseStatus",
    "LicenseTier",
    "TradeLog",
    "User",
    "UserCredentials",
    "UserTier",
    "decrypt_credential",
    "encrypt_credential",
    "generate_fernet_key",
    "get_engine",
    "get_polymarket_credentials_decrypted",
    "get_session",
    "init_db",
    "save_polymarket_credentials",
]
