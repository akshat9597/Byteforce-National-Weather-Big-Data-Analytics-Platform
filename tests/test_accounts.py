from test_lifecycle import app, login
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.database.session import SessionLocal
from app.models.entities import SystemLog


def test_profile_updates_are_limited_and_audited():
    with TestClient(app) as client:
        assert (
            client.patch("/api/auth/profile", json={"name": "Test Name"}).status_code
            == 401
        )
        login(client)
        before = client.get("/api/auth/me").json()
        for data in [
            {"name": "  "},
            {"name": "New Name", "role": "Administrator"},
            {"name": "New Name", "email": "other@example.com"},
        ]:
            assert client.patch("/api/auth/profile", json=data).status_code == 422
        result = client.patch("/api/auth/profile", json={"name": "  Updated Analyst  "})
        assert result.status_code == 200
        assert result.json()["name"] == "Updated Analyst"
        assert (
            result.json()["role"] == before["role"]
            and result.json()["email"] == before["email"]
        )
        assert "password_hash" not in result.json()
        client.patch("/api/auth/profile", json={"name": before["name"]})
        with SessionLocal() as db:
            assert db.scalar(
                select(SystemLog).where(SystemLog.action == "user.profile_updated")
            )


def test_admin_role_workflow_and_live_permissions():
    with TestClient(app) as admin, TestClient(app) as viewer:
        login(admin)
        response = admin.post(
            "/api/admin/users",
            json={
                "name": "Role Test",
                "email": "roles@example.com",
                "password": "Secure-Role-Test-2026!",
                "role": "Viewer",
            },
        )
        assert response.status_code == 201
        uid = response.json()["id"]
        login(viewer, "roles@example.com", "Secure-Role-Test-2026!")
        endpoint = "/api/admin/users/" + uid + "/role"
        body = {
            "role": "Verification Officer",
            "expected_role": "Viewer",
            "reason": "Assigned to regional verification team",
        }
        assert viewer.patch(endpoint, json=body).status_code == 403
        assert admin.patch(endpoint, json={**body, "reason": "  "}).status_code == 422
        assert admin.patch(endpoint, json=body).status_code == 200
        assert viewer.get("/api/auth/me").json()["role"] == "Verification Officer"
        assert viewer.get("/api/reports/RPT-DOES-NOT-EXIST/evidence").status_code == 404
        assert admin.patch(endpoint, json=body).status_code == 409
        me = admin.get("/api/auth/me").json()
        assert (
            admin.patch(
                "/api/admin/users/" + me["id"] + "/role",
                json={**body, "role": "Viewer", "expected_role": "Administrator"},
            ).status_code
            == 409
        )
        assert (
            admin.patch(
                endpoint,
                json={
                    **body,
                    "role": "Viewer",
                    "expected_role": "Verification Officer",
                },
            ).status_code
            == 200
        )
        assert viewer.get("/api/reports/RPT-DOES-NOT-EXIST/evidence").status_code == 403
        with SessionLocal() as db:
            assert db.scalar(
                select(SystemLog).where(SystemLog.action == "user.role_changed")
            )


def test_concurrent_admin_demotions_preserve_an_authorized_admin():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from fastapi import HTTPException
    from app.api.accounts import assign_role, RoleUpdate
    from app.models.entities import User

    with TestClient(app) as client:
        login(client)
        ids = []
        for n in range(2):
            response = client.post(
                "/api/admin/users",
                json={
                    "name": f"Concurrent Admin {n}",
                    "email": f"concurrent-admin-{n}@example.com",
                    "password": "Concurrent-Admin-2026!",
                    "role": "Administrator",
                },
            )
            assert response.status_code == 201
            ids.append(response.json()["id"])
        barrier = Barrier(2)

        def change(index):
            with SessionLocal() as db:
                actor = db.get(User, ids[index])
                barrier.wait(timeout=5)
                try:
                    assign_role(
                        ids[1 - index],
                        RoleUpdate(
                            role="Viewer",
                            expected_role="Administrator",
                            reason="Concurrent role review",
                        ),
                        db,
                        actor,
                    )
                    return 200
                except HTTPException as e:
                    return e.status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(change, [0, 1])) == [200, 403]
        with SessionLocal() as db:
            assert sum(db.get(User, uid).role == "Administrator" for uid in ids) == 1
