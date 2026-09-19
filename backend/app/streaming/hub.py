import asyncio
import json
import os


class Hub:
    def __init__(self):
        self.clients = set()
        self.redis = None

    async def publish(self, payload):
        if os.getenv("REDIS_URL"):
            if not self.redis:
                from redis.asyncio import from_url

                self.redis = from_url(
                    os.environ["REDIS_URL"], socket_connect_timeout=2, socket_timeout=2
                )
            # Propagate failures to the durable outbox; never silently drop writes.
            await self.redis.xadd(
                "weather:reports", {"payload": json.dumps(payload)}, maxlen=10000
            )

        async def send(ws):
            try:
                await asyncio.wait_for(ws.send_json(payload), timeout=2)
            except Exception:
                self.clients.discard(ws)
                try:
                    await asyncio.wait_for(ws.close(code=1013), timeout=1)
                except Exception:
                    pass

        await asyncio.gather(*(send(ws) for ws in tuple(self.clients)))


hub = Hub()
