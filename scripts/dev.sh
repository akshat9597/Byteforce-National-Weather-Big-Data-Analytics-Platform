#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; source .env; set +a; fi
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi
.venv/bin/pip install -r backend/requirements.txt
if [ ! -d frontend/node_modules ]; then npm ci --prefix frontend; fi
.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT INT TERM
NEXT_TELEMETRY_DISABLED=1 npm run dev --prefix frontend
