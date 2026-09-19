"""Add OTP tables without altering existing users or weather data.
Run from the root with DATABASE_URL configured: PYTHONPATH=backend python -m app.database.migrations.002_email_otp
Startup create_all also applies these additive tables for local installations.
"""

from app.database.session import engine
from app.models.entities import OTPChallenge, AuthRateLimit

for model in (OTPChallenge, AuthRateLimit):
    model.__table__.create(engine, checkfirst=True)
