"""Optional daily retention task: PYTHONPATH=backend python scripts/cleanup_auth.py."""

from app.database.session import SessionLocal
from app.services.otp import cleanup

with SessionLocal() as db:
    cleanup(db)
    db.commit()
