"""Small in-process measurements; replace with OpenTelemetry at scale."""

import time
from collections import deque
import psutil

requests = deque(maxlen=10000)
process = psutil.Process()


def record_request(started):
    requests.append((time.monotonic(), (time.monotonic() - started) * 1000))


def snapshot():
    cutoff = time.monotonic() - 60
    recent = [latency for stamp, latency in requests if stamp >= cutoff]
    return {
        "cpu_percent": psutil.cpu_percent(interval=None),
        "process_memory_mb": round(process.memory_info().rss / 1024 / 1024, 1),
        "requests_per_minute": len(recent),
        "api_latency_ms": round(sum(recent) / len(recent), 2) if recent else 0,
    }
