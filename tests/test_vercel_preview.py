"""Run independently: .venv/bin/pytest tests/test_vercel_preview.py"""
import importlib.util
from pathlib import Path
import time
import jwt
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("vercel_preview", ROOT / "frontend/api/preview.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def client():
    return TestClient(module.app, base_url="https://byteforce26069.vercel.app")

def test_workspace_and_read_endpoints():
    started = time.monotonic()
    with client() as c:
        assert c.get("/preview-api/health").json()["hosting"] == "vercel"
        assert c.get("/preview-api/events").status_code == 401
        r = c.post("/preview-api/auth/guest", json={"role": "Administrator"})
        assert r.status_code == 200, r.text
        assert r.json()["is_guest"]
        assert "Secure" in r.headers["set-cookie"]
        for path in ["auth/me", "events", "reports", "analytics/overview", "analytics/states", "sources/status", "alerts", "admin/users", "admin/configuration", "analytics/verification-time"]:
            response = c.get("/preview-api/" + path)
            assert response.status_code == 200, (path, response.text)
        assert time.monotonic() - started < 5
        assert all(u["id"].startswith("GUEST-") for u in c.get("/preview-api/admin/users").json())
        assert c.post("/preview-api/auth/logout").status_code == 200
        assert c.get("/preview-api/events").status_code == 401

def test_preview_isolation_and_read_only():
    with client() as c:
        assert c.post("/preview-api/auth/login", json={}).status_code == 403
        assert c.post("/preview-api/auth/guest", json={"role":"SuperAdmin"}).status_code == 422
        c.post("/preview-api/auth/guest", json={"role":"Viewer"})
        assert c.get("/preview-api/admin/users").status_code == 403
        for path in ["reports", "citizen-reports", "auth/profile", "admin/configuration"]:
            assert c.post("/preview-api/" + path, json={}).status_code == 403
        assert c.get("/preview-api/media/private.png").status_code == 403
    with client() as c:
        # Even a correctly signed non-guest token cannot enter this datastore.
        c.cookies.set("byteforce_session", jwt.encode({"sub":"USR-001","guest":False}, module.SECRET, algorithm="HS256"))
        assert c.get("/preview-api/admin/users").status_code == 401
