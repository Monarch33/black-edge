"""Database engine & session factory for local SQLite."""

from __future__ import annotations

from sqlmodel import SQLModel, Session, create_engine

from blackedge.config import get_settings

_engine = None


def get_engine():  # type: ignore[no-untyped-def]
    global _engine  # noqa: PLW0603
    if _engine is None:
        settings = get_settings()
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(
            f"sqlite:///{settings.db_path}",
            echo=False,
        )
        SQLModel.metadata.create_all(_engine)
    return _engine


def get_session() -> Session:
    return Session(get_engine())
