"""Configuration and secrets loading.

Reads the You.com API key from the environment, falling back to a local
`.env` file (key=value lines). Never hardcode keys in source files.
"""
from __future__ import annotations

import os
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parent / ".env"


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader: populates os.environ without overriding existing vars."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_dotenv(_ENV_FILE)


def get_api_key() -> str:
    """Return the You.com API key or raise a helpful error if missing."""
    key = os.environ.get("YOU_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "YOU_API_KEY is not set. Add it to Wizardry/.env "
            "(YOU_API_KEY=...) or export it in your shell."
        )
    return key


DEFAULT_CRAWL_TIMEOUT = int(os.environ.get("YOU_CRAWL_TIMEOUT", "30"))
