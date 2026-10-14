"""Exercise the packaged deployment in a separate process from production tests."""
from pathlib import Path
import subprocess
import sys


def test_packaged_preview():
    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(Path(__file__).with_name("preview_checks.py")), "-q"],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
