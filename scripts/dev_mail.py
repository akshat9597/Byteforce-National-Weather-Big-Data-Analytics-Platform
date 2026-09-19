"""Loopback-only development inbox. Never forwards mail or prints message contents."""

import os
import signal
from pathlib import Path
from uuid import uuid4
from aiosmtpd.controller import Controller

if os.getenv("APP_ENV") == "production":
    raise RuntimeError("Development inbox cannot run in production")
folder = Path(".local/mail")
folder.mkdir(parents=True, exist_ok=True, mode=0o700)
folder.chmod(0o700)


class Inbox:
    async def handle_DATA(self, server, session, envelope):
        filename = folder / (uuid4().hex + ".eml")
        fd = os.open(filename, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "wb") as target:
            target.write(envelope.original_content)
        return "250 Accepted for local development inbox"


controller = Controller(Inbox(), hostname="127.0.0.1", port=1025)
controller.start()
print(
    "Development SMTP inbox listening on 127.0.0.1:1025; messages saved under .local/mail",
    flush=True,
)
try:
    signal.pause()
finally:
    controller.stop()
