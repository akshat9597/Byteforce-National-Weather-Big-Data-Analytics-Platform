"""Isolated sample workspace on Vercel; production accounts stay on the real API."""
import hashlib
import os
from pathlib import Path
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
archive = ROOT / "server/backend.zip"
runtime = Path(tempfile.gettempdir()) / ("byteforce-preview-" + hashlib.sha256(archive.read_bytes()).hexdigest()[:16])
runtime.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as bundle:
    bundle.extractall(runtime)
sys.path.insert(0, str(runtime))
# Do not use production database, Redis, email credentials or signing keys here.
os.environ["DATABASE_URL"] = "sqlite:///" + str(runtime / "unused.db")
os.environ["JWT_SECRET"] = (ROOT / "server/preview-key").read_text().strip()
os.environ["APP_ENV"] = "production"
os.environ["SIMULATE_FEED"] = "false"
os.environ["REDIS_URL"] = ""
origins = {"https://byteforce26069.vercel.app", "http://localhost:3000"}
for name in ("VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"):
    if os.getenv(name):
        origins.add("https://" + os.environ[name])
os.environ["ALLOWED_ORIGINS"] = ",".join(sorted(origins))

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import jwt
from app.main import app as core
from app.api.auth import SECRET
from app.services.guest import initialize

# Mounted applications do not run the production startup lifespan: no migration,
# real-user seeding, feed simulator, Redis dispatcher or external connection.
app = FastAPI(docs_url=None, openapi_url=None)

@app.middleware("http")
async def preview_only(request: Request, call_next):
    path = request.scope["path"]
    if path.startswith("/preview-api/"):
        path = "/api/" + path[len("/preview-api/"):]
        request.scope["path"] = path
        request.scope["raw_path"] = path.encode()
    if path == "/api/health":
        return JSONResponse({"status": "ok", "mode": "isolated-read-only-preview", "hosting": "vercel"})
    public = {"/api/auth/guest", "/api/auth/guest-options", "/api/auth/guest-ready"}
    if request.method not in {"GET", "HEAD", "OPTIONS"} and path not in {"/api/auth/guest", "/api/auth/logout"}:
        return JSONResponse({"detail": "Sample workspace is read-only."}, status_code=403)
    if path not in public:
        try:
            claims = jwt.decode(request.cookies.get("byteforce_session", ""), SECRET, algorithms=["HS256"])
            if claims.get("guest") is not True or claims.get("sub") not in {"GUEST-Administrator", "GUEST-Viewer"}:
                raise ValueError("Not a preview session")
        except (jwt.PyJWTError, ValueError):
            return JSONResponse({"detail": "Open a sample workspace to continue."}, status_code=401)
    initialize()
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response

app.mount("/", core)
