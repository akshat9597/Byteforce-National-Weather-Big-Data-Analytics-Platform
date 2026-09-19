"""Single-worker transactional outbox with bounded batches and retry backoff.

Delivery is at-least-once: consumers must deduplicate by message_id when applying
side effects. The browser only refreshes authoritative state, so repeats are safe.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from sqlalchemy import select
from app.database.session import SessionLocal
from app.models.entities import OutboxMessage


def enqueue(db, payload):
    message_id = uuid4().hex
    db.add(
        OutboxMessage(
            id=message_id,
            payload=json.dumps({**payload, "message_id": message_id}),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    )
    return message_id


async def dispatch_pending(publish, session_factory=SessionLocal):
    current = datetime.now(timezone.utc)
    delivered = 0
    with session_factory() as db:
        rows = list(
            db.scalars(
                select(OutboxMessage)
                .where(
                    OutboxMessage.delivered_at == "",
                    OutboxMessage.next_attempt_at <= current.isoformat(),
                )
                .order_by(OutboxMessage.created_at, OutboxMessage.id)
                .limit(100)
            )
        )
        for row in rows:
            row.attempts += 1
            try:
                await publish(json.loads(row.payload))
            except Exception as exc:
                # Store only the exception type; connection strings may contain secrets.
                row.last_error = type(exc).__name__
                row.next_attempt_at = (
                    current + timedelta(seconds=min(300, 2 ** min(row.attempts, 8)))
                ).isoformat()
                logging.warning(
                    "Outbox delivery delayed: %s (%s)", row.id, row.last_error
                )
            else:
                row.delivered_at = datetime.now(timezone.utc).isoformat()
                row.last_error = ""
                delivered += 1
            db.commit()
    return delivered


async def run_dispatcher(publish):
    while True:
        try:
            await dispatch_pending(publish)
        except Exception:
            logging.exception("Outbox dispatcher cycle failed")
        await asyncio.sleep(0.5)
