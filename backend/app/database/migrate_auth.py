"""Idempotent additive migration; preserves all existing account/weather records."""

from sqlalchemy import inspect, text


def migrate(engine):
    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            connection.execute(text("SELECT pg_advisory_xact_lock(26069003)"))
        additions = {
            "users": {"last_login_at": "VARCHAR"},
            "otp_challenges": {
                "email": "VARCHAR",
                "created_at": "FLOAT",
                "used_at": "FLOAT",
                "delivery_id": "VARCHAR",
            },
        }
        for table, columns in additions.items():
            existing = {
                column["name"] for column in inspect(connection).get_columns(table)
            }
            for column, kind in columns.items():
                if column not in existing:
                    connection.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {kind}")
                    )


if __name__ == "__main__":
    from app.database.session import engine, Base
    from app.models import entities  # registers existing models

    Base.metadata.create_all(engine)
    migrate(engine)
