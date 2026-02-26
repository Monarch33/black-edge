"""
Credential Helpers — Encrypt on write, decrypt on read
======================================================
Use these functions instead of raw DB access for UserCredentials.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from .encryption import decrypt_credential, encrypt_credential
from .models import UserCredentials


def save_polymarket_credentials(
    session: Session,
    user_id: int,
    polymarket_proxy_key: str,
    polymarket_secret: str,
    polymarket_passphrase: str = "",
) -> UserCredentials:
    """
    Store Polymarket keys — encrypts before DB insert.
    All three fields encrypted with Fernet before storage.
    """
    enc_proxy = encrypt_credential(polymarket_proxy_key)
    enc_secret = encrypt_credential(polymarket_secret)
    enc_passphrase = encrypt_credential(polymarket_passphrase) if polymarket_passphrase else ""

    existing = session.query(UserCredentials).filter(UserCredentials.user_id == user_id).first()
    if existing:
        existing.polymarket_proxy_key = enc_proxy
        existing.polymarket_secret = enc_secret
        existing.polymarket_passphrase = enc_passphrase
        return existing

    cred = UserCredentials(
        user_id=user_id,
        polymarket_proxy_key=enc_proxy,
        polymarket_secret=enc_secret,
        polymarket_passphrase=enc_passphrase,
    )
    session.add(cred)
    return cred


def get_polymarket_credentials_decrypted(
    session: Session,
    user_id: int,
) -> Optional[tuple[str, str, str]]:
    """
    Retrieve Polymarket keys decrypted.

    Returns:
        (proxy_key, secret, passphrase) or None if not found
    """
    row = session.query(UserCredentials).filter(UserCredentials.user_id == user_id).first()
    if not row:
        return None
    proxy = decrypt_credential(row.polymarket_proxy_key)
    secret = decrypt_credential(row.polymarket_secret)
    passphrase = decrypt_credential(row.polymarket_passphrase) if row.polymarket_passphrase else ""
    return (proxy, secret, passphrase)
