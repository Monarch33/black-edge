"""License verification gate — calls backend API at startup."""

from __future__ import annotations

import sys
from typing import Any

import httpx
from rich.console import Console

from blackedge.config import get_settings

_console = Console()

# Fallback: minimal format check before even hitting the API
_VALID_PREFIX = "BE-"
_MIN_KEY_LEN = 8


def _format_check(key: str) -> bool:
    """Quick local format validation before API call."""
    return key.startswith(_VALID_PREFIX) and len(key) >= _MIN_KEY_LEN


def verify_license(key: str) -> bool:
    """
    Verify *key* against the backend API.

    Returns True if the license is valid (active, not expired).
    Returns False if invalid, expired, revoked, or API unreachable.
    """
    if not _format_check(key):
        return False

    settings = get_settings()
    url = f"{settings.api_base_url.rstrip('/')}/api/auth/verify"

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json={"key": key})
    except httpx.RequestError:
        _console.print("[bold yellow]⚠ API unreachable. Check BE_API_BASE_URL.[/]")
        return False

    if resp.status_code == 200:
        data: dict[str, Any] = resp.json()
        return data.get("valid", False) is True

    return False


def enforce_license(key: str) -> None:
    """
    Verify *key* against the backend API or terminate the process.

    If the API returns 403 (invalid/expired/revoked), the bot self-destructs.
    """
    if not _format_check(key):
        _console.print("[bold red]✖ Invalid license format. Key must start with BE- and be at least 8 chars.[/]")
        sys.exit(1)

    settings = get_settings()
    url = f"{settings.api_base_url.rstrip('/')}/api/auth/verify"

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json={"key": key})
    except httpx.RequestError as e:
        _console.print(f"[bold red]✖ Cannot reach license server: {e}[/]")
        _console.print("[dim]Check BE_API_BASE_URL and network.[/]")
        sys.exit(1)

    if resp.status_code == 200:
        data = resp.json()
        if data.get("valid"):
            tier = data.get("tier", "runner")
            _console.print(f"[bold green]✔ License validated:[/] {key[:8]}•••• (tier={tier})")
            return

    # 403 or any other failure → self-destruct
    try:
        err_data = resp.json()
        detail = err_data.get("detail", err_data)
        if isinstance(detail, dict):
            msg = detail.get("message", str(detail))
        else:
            msg = str(detail)
    except Exception:
        msg = resp.text or "License invalid or expired."

    _console.print(f"[bold red]✖ {msg}[/]")
    _console.print("[bold red]Shutting down.[/]")
    sys.exit(1)
