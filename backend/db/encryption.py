"""
Fernet Encryption for User Credentials
======================================
Encrypts polymarket_proxy_key and polymarket_secret before storing in DB.
Uses cryptography.fernet — keys must be 32-byte base64.
"""

from __future__ import annotations

import base64
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def get_fernet() -> Fernet:
    """Return Fernet instance from FERNET_KEY. Crashes if missing."""
    try:
        from config import get_settings
        key = get_settings().fernet_key
    except Exception:
        key = os.environ.get("FERNET_KEY", "").strip()
    if not key:
        raise ValueError(
            "FERNET_KEY is required for credential encryption. "
            "Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as e:
        raise ValueError(f"Invalid FERNET_KEY: {e}") from e


def encrypt_credential(plain: str) -> str:
    """
    Encrypt a credential string for storage.

    Args:
        plain: Raw secret (e.g. polymarket_proxy_key or polymarket_secret)

    Returns:
        Base64-encoded ciphertext (safe to store in DB)
    """
    if not plain:
        return ""
    f = get_fernet()
    return f.encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_credential(cipher: Optional[str]) -> str:
    """
    Decrypt a stored credential.

    Args:
        cipher: Base64-encoded ciphertext from DB

    Returns:
        Plaintext secret, or empty string if cipher is empty/None
    """
    if not cipher or not cipher.strip():
        return ""
    try:
        f = get_fernet()
        return f.decrypt(cipher.encode("ascii")).decode("utf-8")
    except InvalidToken:
        raise ValueError("Credential decryption failed — FERNET_KEY may have changed or data is corrupted")


def generate_fernet_key() -> str:
    """Generate a new Fernet key for .env.local. Use once, store securely."""
    return Fernet.generate_key().decode("ascii")


def derive_fernet_from_secret(secret: str, salt: Optional[bytes] = None) -> bytes:
    """
    Derive a Fernet key from a master secret (e.g. JWT_SECRET_KEY).
    Use only if you cannot store a separate FERNET_KEY.

    Args:
        secret: Master secret string
        salt: Optional salt (default: b"blackedge-credentials")

    Returns:
        32-byte key suitable for Fernet
    """
    salt = salt or b"blackedge-credentials"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))
    return key
