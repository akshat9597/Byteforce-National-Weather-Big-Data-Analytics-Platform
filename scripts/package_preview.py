"""Package only backend source for the isolated Vercel preview function."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
ROOT = Path(__file__).resolve().parents[1]
output = ROOT / "frontend/server/backend.zip"
with ZipFile(output, "w", ZIP_DEFLATED) as bundle:
    for source in sorted((ROOT / "backend/app").rglob("*.py")):
        entry = ZipInfo(source.relative_to(ROOT / "backend").as_posix(), (2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        bundle.writestr(entry, source.read_bytes())
print(f"Packaged {output.stat().st_size} bytes")
