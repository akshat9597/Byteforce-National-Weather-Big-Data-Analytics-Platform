"""Idempotently seed the configured development database."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))
from app.database.session import Base, engine, SessionLocal
from app.services.seed import seed

Base.metadata.create_all(engine)
with SessionLocal() as db:
    seed(db)
print(
    "Development seed ready: 144 reports across 18 locations in 10 states/territories."
)
