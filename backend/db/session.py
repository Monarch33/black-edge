"""
Database Session Factory
========================
Sync session for startup/migrations, async session for request handlers.
"""

from __future__ import annotations

from contextlib import asynccontextmanager, contextmanager
from typing import AsyncGenerator, Generator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base, _get_engine_url

_engine = None
_SessionLocal = None
_async_engine = None
_AsyncSessionLocal = None


# ---------------------------------------------------------------------------
# Sync (used for init_db, migrations, CLI)
# ---------------------------------------------------------------------------

def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(_get_engine_url(), echo=False)
    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


@contextmanager
def get_session() -> Generator[Session, None, None]:
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


# ---------------------------------------------------------------------------
# Async (used in FastAPI endpoints and orchestrator)
# ---------------------------------------------------------------------------

def _get_async_engine_url() -> str:
    """Convert sync URL to async driver URL."""
    url = _get_engine_url()
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    # SQLite fallback (dev)
    return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)


def get_async_engine():
    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_engine(
            _get_async_engine_url(),
            echo=False,
            pool_pre_ping=True,
            pool_size=20,
            max_overflow=40,
        )
    return _async_engine


def get_async_session_factory():
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            bind=get_async_engine(),
            expire_on_commit=False,
            class_=AsyncSession,
        )
    return _AsyncSessionLocal


@asynccontextmanager
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    factory = get_async_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
