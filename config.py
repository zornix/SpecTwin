"""Configuration and secrets loading.

Reads API keys from the environment, falling back to local dotenv files
(``.env`` for the You.com key, ``.env.local`` for the InsForge-provisioned
OpenRouter key written by ``npx @insforge/cli ai setup``). Never hardcode keys
in source files.
"""
from __future__ import annotations

import os
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_ENV_FILE = _HERE / ".env"
_ENV_LOCAL_FILE = _HERE / ".env.local"


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
_load_dotenv(_ENV_LOCAL_FILE)


def get_api_key() -> str:
    """Return the You.com API key or raise a helpful error if missing."""
    key = os.environ.get("YOU_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "YOU_API_KEY is not set. Add it to Wizardry/.env "
            "(YOU_API_KEY=...) or export it in your shell."
        )
    return key


def get_openrouter_key() -> str:
    """Return the OpenRouter key (InsForge AI gateway) or raise a helpful error.

    The key is provisioned by ``npx @insforge/cli ai setup``, which writes
    ``OPENROUTER_API_KEY`` into ``.env.local``.
    """
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. Run `npx @insforge/cli ai setup` in "
            "Wizardry/ (writes it to .env.local), or export it in your shell."
        )
    return key


DEFAULT_CRAWL_TIMEOUT = int(os.environ.get("YOU_CRAWL_TIMEOUT", "30"))

# Model used to normalize marketing descriptions into canonical style profiles.
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
STYLE_PROFILE_MODEL = os.environ.get("OPENROUTER_CHAT_MODEL", "openai/gpt-4o-mini")
