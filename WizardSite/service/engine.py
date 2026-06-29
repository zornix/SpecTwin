"""Bridge the FastAPI service to the repo-root recommendation stack.

The real matcher (``match.py`` + ``features``/``imagesim``/``descsim``) and its
data (``specs.json`` and the cached CLIP / description embeddings) live in the
Wizardry project root, two levels up from this file. We add that root to
``sys.path`` and reuse it verbatim — no logic is duplicated here.

Cost lives at startup, not per request: the catalog and the full (n, n)
similarity matrix are computed once and cached, so each ``/match`` call is just a
target lookup + a row sort. Tunables come from the environment:

    MATCH_MODE     blended | spec-only | desc-only   (default: blended)
    MATCH_ALPHA    image (CLIP) weight               (default: 0.4)
    MATCH_TEXT     description (style) weight         (default: 0.2)
    MATCH_TOP_N    matches returned per request       (default: 3)
"""

from __future__ import annotations

import os
import sys
import threading
from pathlib import Path
from typing import Optional

# --- make the repo-root engine importable ------------------------------------
_ROOT = Path(__file__).resolve().parents[2]  # …/Wizardry
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np  # noqa: E402

from match import (  # noqa: E402
    combined_similarity,
    find_target,
    load_specs,
    recommend,
)

from catalog_adapter import spec_to_sunglasses, specs_to_matches  # noqa: E402
from models import MatchResponse  # noqa: E402


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


MATCH_MODE = os.environ.get("MATCH_MODE", "blended").strip().lower()
MATCH_ALPHA = _env_float("MATCH_ALPHA", 0.4)
MATCH_TEXT = _env_float("MATCH_TEXT", 0.2)
DEFAULT_TOP_N = int(_env_float("MATCH_TOP_N", 3))


class _Catalog:
    """Lazily-loaded catalog + similarity matrix, computed once and cached."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._specs: Optional[list[dict]] = None
        self._sim: Optional[np.ndarray] = None

    def _ensure(self) -> tuple[list[dict], np.ndarray]:
        if self._specs is not None and self._sim is not None:
            return self._specs, self._sim
        with self._lock:
            if self._specs is None or self._sim is None:
                specs = load_specs()
                if not specs:
                    raise RuntimeError(
                        "specs.json is empty or missing in the project root."
                    )
                sim = combined_similarity(
                    specs,
                    alpha=MATCH_ALPHA,
                    text_weight=MATCH_TEXT,
                    spec_only=(MATCH_MODE == "spec-only"),
                    desc_only=(MATCH_MODE == "desc-only"),
                )
                self._specs, self._sim = specs, sim
        return self._specs, self._sim

    def warm(self) -> int:
        """Eagerly build the matrix (called at startup). Returns catalog size."""
        specs, _ = self._ensure()
        return len(specs)

    def match(self, url: str, top_n: int = DEFAULT_TOP_N) -> Optional[MatchResponse]:
        """Return a MatchResponse for a catalog URL, or ``None`` if not found."""
        specs, sim = self._ensure()
        idx = find_target(specs, url)
        if idx is None:
            return None
        recs = recommend(specs, idx, sim, top_n=top_n, cheaper_only=True)
        source = spec_to_sunglasses(specs[idx])
        scored = [(specs[j], score) for j, score in recs]
        matches = specs_to_matches(source, scored)
        return MatchResponse(source=source, matches=matches, engine="fastapi")


_CATALOG = _Catalog()


def warm() -> int:
    return _CATALOG.warm()


def match_url(url: str, top_n: int = DEFAULT_TOP_N) -> Optional[MatchResponse]:
    return _CATALOG.match(url, top_n=top_n)
