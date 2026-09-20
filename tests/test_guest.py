from test_lifecycle import app, login
from fastapi.testclient import TestClient
from app.main import LOGIN_ATTEMPTS


def test_guest_roles_isolation_and_logout():
    LOGIN_ATTEMPTS.clear()
    with TestClient(app) as real, TestClient(app) as guest:
        login(real)
        real_users = real.get("/api/admin/users").json()
        for role in ("Administrator", "Viewer"):
            response = guest.post("/api/auth/guest", json={"role": role})
            assert response.status_code == 200
            assert response.json()["is_guest"] is True
            assert "password_hash" not in response.json()
            cookie = response.headers["set-cookie"]
            assert "HttpOnly" in cookie and "SameSite=lax" in cookie
            assert guest.get("/api/auth/me").json()["role"] == role
            assert guest.get("/api/events").status_code == 200
            users = guest.get("/api/admin/users")
            if role == "Administrator":
                assert users.status_code == 200
                assert all(u["id"].startswith("GUEST-") for u in users.json())
            else:
                assert users.status_code == 403
            for path in (
                "/api/admin/users",
                "/api/citizen-reports",
                "/api/auth/profile",
                "/api/admin/configuration",
            ):
                method = (
                    guest.patch
                    if path.endswith(("profile", "configuration"))
                    else guest.post
                )
                assert method(path, json={}).status_code == 403
            assert guest.get("/api/media/private.png").status_code == 403
            assert guest.get("/api/health").status_code == 403
            from starlette.websockets import WebSocketDisconnect
            import pytest

            with pytest.raises(WebSocketDisconnect):
                with guest.websocket_connect(
                    "/ws", headers={"origin": "http://localhost:3000"}
                ):
                    pass
            assert guest.post("/api/auth/logout").status_code == 200
            assert guest.get("/api/auth/me").status_code == 401
        assert real.get("/api/admin/users").json() == real_users


def test_guest_disabled_and_payload_validation(monkeypatch):
    LOGIN_ATTEMPTS.clear()
    with TestClient(app) as client:
        assert (
            client.post("/api/auth/guest", json={"role": "SuperAdmin"}).status_code
            == 422
        )
        assert (
            client.post(
                "/api/auth/guest", json={"role": "Viewer", "id": "USR-001"}
            ).status_code
            == 422
        )
        assert (
            client.post("/api/auth/guest", json={"role": "Viewer"}).status_code == 200
        )
        monkeypatch.setenv("GUEST_LOGIN_ENABLED", "false")
        assert client.get("/api/auth/me").status_code == 401
        assert client.post("/api/auth/logout").status_code == 200
        assert client.get("/api/auth/guest-options").json() == {"enabled": False}
        assert (
            client.post("/api/auth/guest", json={"role": "Viewer"}).status_code == 403
        )


def test_guest_rate_limit():
    LOGIN_ATTEMPTS.clear()
    with TestClient(app) as client:
        for _ in range(20):
            assert (
                client.post("/api/auth/guest", json={"role": "Viewer"}).status_code
                == 200
            )
        assert (
            client.post("/api/auth/guest", json={"role": "Viewer"}).status_code == 429
        )
    LOGIN_ATTEMPTS.clear()
