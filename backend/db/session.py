"""
Database Session Factory
=======================
Provides get_session() and get_engine() for the auth layer.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base, _get_engine_url

_engine = None
_SessionLocal = None


def get_engine():
    """Return the shared SQLAlchemy engine."""
    global _engine
    if _engine is None:
        url = _get_engine_url()
        _engine = create_engine(url, echo=False)
    return _engine


def get_session_factory():
    """Return the session factory."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=get_engine(),
        )
    return _SessionLocal


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Context manager for database sessions."""
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
