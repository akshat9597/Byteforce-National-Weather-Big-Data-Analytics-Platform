from concurrent.futures import ThreadPoolExecutor
import time
import pytest
from test_lifecycle import app
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from app.database.session import SessionLocal
from app.models.entities import OTPChallenge, AuthRateLimit
from app.services import otp


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv(
        "OTP_HASH_SECRET", "independent-test-secret-with-at-least-32-characters"
    )
    monkeypatch.setenv("EMAIL_PROVIDER", "smtp")
    monkeypatch.setenv("APP_ENV", "test")
    sent = []
    monkeypatch.setattr(
        otp, "deliver_code", lambda recipient, code: sent.append((recipient, code))
    )
    with TestClient(app) as client:
        with SessionLocal() as db:
            db.execute(delete(OTPChallenge))
            db.execute(delete(AuthRateLimit))
            db.commit()
        yield client, sent


def request(client, email="admin@byteforce.local"):
    r = client.post("/api/auth/otp/request", json={"email": email})
    assert r.status_code == 200, r.text
    return r.json()


def verify(client, challenge, code):
    return client.post(
        "/api/auth/otp/verify",
        json={"challenge_id": challenge["challenge_id"], "code": code},
    )


def test_success_hash_and_replay(setup):
    c, sent = setup
    ch = request(c)
    code = sent[-1][1]
    assert code not in str(ch)
    with SessionLocal() as db:
        row = db.get(OTPChallenge, ch["challenge_id"])
        assert row.code_hash != code and len(row.code_hash) == 64
    r = verify(c, ch, code)
    assert r.status_code == 200 and r.json()["role"] == "Administrator"
    assert "HttpOnly" in r.headers["set-cookie"]
    assert "password_hash" not in r.json()
    assert c.get("/api/reports").status_code == 200
    assert verify(c, ch, code).status_code == 400


def test_wrong_code_exhaustion_and_expiry(setup):
    c, sent = setup
    ch = request(c)
    right = sent[-1][1]
    wrong = "000000" if right != "000000" else "111111"
    for _ in range(5):
        assert verify(c, ch, wrong).status_code == 400
    assert verify(c, ch, right).status_code == 400
    with SessionLocal() as db:
        row = db.get(OTPChallenge, ch["challenge_id"])
        assert row.consumed and row.attempts == 5
        row.consumed = False
        row.attempts = 0
        row.expires_at = time.time() - 1
        db.commit()
    assert verify(c, ch, right).status_code == 400


def test_resend_and_limits(setup):
    c, sent = setup
    first = request(c)
    old = sent[-1][1]
    blocked = c.post("/api/auth/otp/request", json={"email": "admin@byteforce.local"})
    assert blocked.status_code == 429 and int(blocked.headers["retry-after"]) > 0
    with SessionLocal() as db:
        for row in db.scalars(select(AuthRateLimit)):
            row.next_allowed = 0
        db.commit()
    second = request(c)
    assert verify(c, first, old).status_code == 400
    assert verify(c, second, sent[-1][1]).status_code == 200
    with SessionLocal() as db:
        for row in db.scalars(
            select(AuthRateLimit).where(AuthRateLimit.key.like("otp.request.email:%"))
        ):
            row.count = 5
            row.next_allowed = 0
        db.commit()
    assert (
        c.post(
            "/api/auth/otp/request", json={"email": "admin@byteforce.local"}
        ).status_code
        == 429
    )


def test_unknown_account_and_provider_failure(setup, monkeypatch):
    c, sent = setup
    known = request(c)
    unknown = request(c, "unknown@example.test")
    assert (
        known["message"] == unknown["message"] and sent[-1][0] == "unknown@example.test"
    )
    assert verify(c, unknown, sent[-1][1]).json()["role"] == "Viewer"

    def fail(*args):
        raise RuntimeError("Sensitive transport details")

    monkeypatch.setattr(otp, "deliver_code", fail)
    r = c.post("/api/auth/otp/request", json={"email": "other@example.test"})
    assert r.status_code == 503 and "Sensitive" not in r.text
    with SessionLocal() as db:
        assert all(
            row.consumed
            for row in db.scalars(
                select(OTPChallenge).where(OTPChallenge.ready == False)
            )
        )


def test_atomic_single_use(setup):
    c, sent = setup
    ch = request(c)
    code = sent[-1][1]

    def consume(_):
        with SessionLocal() as db:
            try:
                otp.verify_code(db, ch["challenge_id"], code, "concurrent")
                return 200
            except HTTPException as e:
                return e.status_code

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(consume, range(4)))
    assert sorted(results) == [200, 400, 400, 400]


def test_origin_and_config_guards(setup, monkeypatch):
    c, _ = setup
    assert (
        c.post(
            "/api/auth/otp/request",
            json={"email": "admin@byteforce.local"},
            headers={"Origin": "https://evil.test"},
        ).status_code
        == 403
    )
    monkeypatch.delenv("OTP_HASH_SECRET")
    assert (
        c.post(
            "/api/auth/otp/request", json={"email": "admin@byteforce.local"}
        ).status_code
        == 503
    )


def test_smtp_transport(monkeypatch):
    import socket
    from aiosmtpd.controller import Controller
    from app.services.email_delivery import deliver_code

    received = []

    class Inbox:
        async def handle_DATA(self, server, session, envelope):
            received.append(envelope)
            return "250 OK"

    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    for k, v in {
        "EMAIL_PROVIDER": "smtp",
        "SMTP_HOST": "127.0.0.1",
        "SMTP_PORT": str(port),
        "SMTP_SECURITY": "none",
        "SMTP_FROM": "test@byteforce.local",
        "APP_ENV": "development",
    }.items():
        monkeypatch.setenv(k, v)
    monkeypatch.delenv("SMTP_USERNAME", raising=False)
    controller = Controller(Inbox(), hostname="127.0.0.1", port=port)
    controller.start()
    try:
        deliver_code("admin@byteforce.local", "123456")
        deliver_code(None, "654321")
        assert len(received) == 1 and b"123456" in received[0].original_content
    finally:
        controller.stop()


def test_viewer_role_and_secure_cookie(setup, monkeypatch):
    from test_lifecycle import login

    c, sent = setup
    login(c)
    response = c.post(
        "/api/admin/users",
        json={
            "name": "OTP Viewer",
            "email": "otp-viewer@example.test",
            "password": "Viewer-Test-Password-2026!",
            "role": "Viewer",
        },
    )
    assert response.status_code == 201
    c.cookies.clear()
    ch = request(c, "otp-viewer@example.test")
    result = verify(c, ch, sent[-1][1])
    assert result.status_code == 200 and result.json()["role"] == "Viewer"
    assert c.get("/api/reports").status_code == 200
    assert c.get("/api/admin/users").status_code == 403
    c.cookies.clear()
    ch = request(c)
    monkeypatch.setenv("APP_ENV", "production")
    result = verify(c, ch, sent[-1][1])
    assert result.status_code == 200 and "Secure" in result.headers["set-cookie"]


def test_ip_limits(setup):
    c, sent = setup
    ch = request(c)
    with SessionLocal() as db:
        row = db.scalar(
            select(AuthRateLimit).where(AuthRateLimit.key.like("otp.request.ip:%"))
        )
        row.count = 20
        db.commit()
    assert (
        c.post(
            "/api/auth/otp/request", json={"email": "different@example.test"}
        ).status_code
        == 429
    )
    assert (
        verify(c, ch, "000000" if sent[-1][1] != "000000" else "111111").status_code
        == 400
    )
    with SessionLocal() as db:
        row = db.scalar(
            select(AuthRateLimit).where(AuthRateLimit.key.like("otp.verify.ip:%"))
        )
        row.count = 60
        db.commit()
    assert verify(c, ch, sent[-1][1]).status_code == 429


def test_resend_delivery_and_failures(monkeypatch):
    from app.services import email_delivery

    monkeypatch.setenv("EMAIL_PROVIDER", "resend")
    monkeypatch.setenv("RESEND_API_KEY", "re_test_secret")
    monkeypatch.setenv("EMAIL_FROM", "BYTEFORCE <otp@example.test>")
    sent = []
    monkeypatch.setattr(
        email_delivery.resend.Emails,
        "send",
        lambda params: sent.append(params) or {"id": "test-message"},
    )
    assert email_delivery.deliver_code("user@example.test", "123456") == "test-message"
    assert sent[0]["from"] == "BYTEFORCE <otp@example.test>"
    assert sent[0]["to"] == ["user@example.test"]
    assert sent[0]["subject"] == "BYTEFORCE Verification Code"
    assert "123456" in sent[0]["html"] and "123456" in sent[0]["text"]

    def fail(params):
        raise RuntimeError("private provider details")

    monkeypatch.setattr(email_delivery.resend.Emails, "send", fail)
    with pytest.raises(RuntimeError, match="Email delivery unavailable"):
        email_delivery.deliver_code("user@example.test", "123456")
    monkeypatch.delenv("RESEND_API_KEY")
    with pytest.raises(RuntimeError, match="Resend is not configured"):
        email_delivery.deliver_code("user@example.test", "123456")


def test_new_routes_normalization_creation_and_logout(setup):
    from app.models.entities import User, SystemLog

    c, sent = setup
    r = c.post("/api/auth/send-otp", json={"email": "  New.Viewer@Example.com  "})
    assert (
        r.status_code == 200
        and r.json()["resend_after"] == 45
        and r.json()["expires_in"] == 300
    )
    assert sent[-1][0] == "new.viewer@example.com"
    with SessionLocal() as db:
        assert not db.scalar(select(User).where(User.email == "new.viewer@example.com"))
    r = c.post(
        "/api/auth/verify-otp",
        json={"email": "New.Viewer@Example.com", "otp": sent[-1][1]},
    )
    assert (
        r.status_code == 200
        and r.json()["role"] == "Viewer"
        and r.json()["last_login_at"]
    )
    assert c.get("/api/auth/me").json()["id"] == r.json()["id"]
    assert c.get("/api/admin/users").status_code == 403
    assert c.post("/api/auth/logout").status_code == 200
    assert c.get("/api/reports").status_code == 401
    assert (
        c.post(
            "/api/auth/verify-otp",
            json={"email": "new.viewer@example.com", "otp": sent[-1][1]},
        ).status_code
        == 400
    )
    with SessionLocal() as db:
        row = db.scalar(
            select(OTPChallenge).where(OTPChallenge.email == "new.viewer@example.com")
        )
        assert row.used_at and row.created_at and row.consumed
        logs = list(db.scalars(select(SystemLog)))
        assert any(row.action == "user.logged_out" for row in logs)
        assert all(sent[-1][1] not in row.detail for row in logs)


@pytest.mark.parametrize(
    "email", ["bad", "a@@b.com", "a b@example.com", "x@example.com\r\nBcc:x@evil.com"]
)
def test_invalid_email(setup, email):
    c, sent = setup
    assert c.post("/api/auth/send-otp", json={"email": email}).status_code == 422
    assert not sent


def test_untrusted_role_rejected(setup):
    c, sent = setup
    assert (
        c.post(
            "/api/auth/send-otp",
            json={"email": "x@example.com", "role": "Administrator"},
        ).status_code
        == 422
    )


def test_database_failure_sends_no_email(setup, monkeypatch):
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Session

    c, sent = setup

    def fail(*args, **kwargs):
        raise OperationalError("private query", {}, Exception("private details"))

    monkeypatch.setattr(Session, "commit", fail)
    r = c.post("/api/auth/send-otp", json={"email": "failure@example.com"})
    assert r.status_code == 503 and "private" not in r.text and not sent


def test_cleanup_and_configurable_expiry(setup, monkeypatch):
    c, sent = setup
    monkeypatch.setenv("OTP_EXPIRY_MINUTES", "3")
    ch = request(c)
    assert ch["expires_in"] == 180
    with SessionLocal() as db:
        db.get(OTPChallenge, ch["challenge_id"]).expires_at = time.time() - 90000
        db.commit()
    request(c, "cleanup@example.com")
    with SessionLocal() as db:
        assert db.get(OTPChallenge, ch["challenge_id"]) is None


def test_migration_preserves_existing_data(tmp_path):
    from sqlalchemy import create_engine, text, inspect
    from app.database.migrate_auth import migrate

    engine = create_engine("sqlite:///" + str(tmp_path / "old.db"))
    with engine.begin() as con:
        con.execute(
            text(
                "CREATE TABLE users (id VARCHAR PRIMARY KEY, email VARCHAR, role VARCHAR)"
            )
        )
        con.execute(
            text(
                "INSERT INTO users VALUES ('existing', 'existing@example.com', 'Administrator')"
            )
        )
        con.execute(text("CREATE TABLE otp_challenges (id VARCHAR PRIMARY KEY)"))
    migrate(engine)
    migrate(engine)
    with engine.connect() as con:
        assert con.execute(text("SELECT role FROM users")).scalar() == "Administrator"
        assert {"email", "created_at", "used_at", "delivery_id"} <= {
            c["name"] for c in inspect(con).get_columns("otp_challenges")
        }
    engine.dispose()


def test_email_verification_prefers_new_request_over_legacy_null_timestamp(setup):
    c, sent = setup
    old = request(c)
    with SessionLocal() as db:
        row = db.get(OTPChallenge, old["challenge_id"])
        row.created_at = None
        for bucket in db.scalars(select(AuthRateLimit)):
            bucket.next_allowed = 0
        db.commit()
    request(c)
    r = c.post(
        "/api/auth/verify-otp",
        json={"email": "admin@byteforce.local", "otp": sent[-1][1]},
    )
    assert r.status_code == 200


def test_verification_database_failure_never_creates_session(setup, monkeypatch):
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Session

    c, sent = setup
    ch = request(c, "transaction@example.com")

    def fail(*args, **kwargs):
        raise OperationalError("private query", {}, Exception("private details"))

    with monkeypatch.context() as patch:
        patch.setattr(Session, "commit", fail)
        r = c.post(
            "/api/auth/verify-otp",
            json={"email": "transaction@example.com", "otp": sent[-1][1]},
        )
    assert r.status_code == 503 and "set-cookie" not in r.headers
    with SessionLocal() as db:
        assert not db.get(OTPChallenge, ch["challenge_id"]).consumed
    assert (
        c.post(
            "/api/auth/verify-otp",
            json={"email": "transaction@example.com", "otp": sent[-1][1]},
        ).status_code
        == 200
    )


def test_no_code_echo_in_validation_errors(setup):
    c, _ = setup
    r = c.post(
        "/api/auth/verify-otp",
        json={"email": "invalid", "otp": "123456", "role": "Administrator"},
    )
    assert r.status_code == 422 and "123456" not in r.text
    assert r.headers["cache-control"] == "no-store"
