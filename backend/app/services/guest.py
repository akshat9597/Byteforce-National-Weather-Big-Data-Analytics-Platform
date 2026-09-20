"""Isolated, read-only guest previews. Never copy production rows into this store."""

import os
import tempfile
from threading import Lock
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.session import Base
from app.models.entities import User
from app.services.pipeline import now

_lock = Lock()
_factory = None
_directory = None


def enabled():
    return os.getenv("GUEST_LOGIN_ENABLED", "true").lower() == "true"


def sessions():
    global _factory, _directory
    with _lock:
        if _factory is None:
            from app.services.seed import seed

            _directory = tempfile.TemporaryDirectory(prefix="byteforce-guest-")
            engine = create_engine(
                "sqlite:///" + str(Path(_directory.name) / "preview.db"),
                connect_args={"check_same_thread": False},
            )
            Base.metadata.create_all(engine)
            factory = sessionmaker(bind=engine, expire_on_commit=False)
            with factory() as db:
                for role in ("Administrator", "Viewer"):
                    db.add(
                        User(
                            id="GUEST-" + role,
                            name="Guest " + role,
                            email=role.lower() + "@guest.invalid",
                            password_hash="!disabled",
                            role=role,
                            organization="BYTEFORCE sample workspace",
                            created_at=now(),
                        )
                    )
                db.flush()
                seed(db)
            _factory = factory
    return _factory
