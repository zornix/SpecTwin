"""Text-embedding similarity between sunglasses based on their descriptions.

Embeds each frame's **style profile** (a brand-agnostic rewrite of the marketing
description produced by ``style_profile.py``) with a local sentence-transformer
(``all-MiniLM-L6-v2``) and compares them by cosine similarity. Embeddings are
cached by a hash of the profile text in ``desc_embeddings.json`` so re-runs are
cheap.

This is the third matching signal, complementing:
  * spec similarity   (``features.py``)  — measurements + categorical fields
  * visual similarity (``imagesim.py``)  — CLIP over the product photo

Like ``imagesim``, this module is optional: ``match.py`` degrades to the other
signals when the model is unavailable or no profiles exist. Frames with no usable
text get a zero vector and contribute no signal.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import List, Sequence

import numpy as np

from style_profile import cached_profiles

HERE = Path(__file__).resolve().parent
EMBED_CACHE = HERE / "desc_embeddings.json"
MODEL_NAME = "all-MiniLM-L6-v2"

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(MODEL_NAME)
    return _model


def _text_key(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def profile_texts(specs: Sequence[dict]) -> List[str]:
    """Text to embed per spec: the cached style profile, else the raw description.

    Falling back to the raw description means the signal still works (just noisier)
    if ``style_profile.py`` has not been run yet.
    """
    profiles = cached_profiles(specs)
    out: List[str] = []
    for spec, profile in zip(specs, profiles):
        text = (profile or "").strip() or (spec.get("description") or "").strip()
        out.append(text)
    return out


def _load_embed_cache() -> dict:
    if EMBED_CACHE.exists():
        try:
            return json.loads(EMBED_CACHE.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def embed_specs(specs: Sequence[dict], verbose: bool = True) -> np.ndarray:
    """Return an (n, d) L2-normalized embedding matrix for the catalog's profiles.

    Cached by profile-text hash; rows whose text is empty are left as zeros.
    """
    cache = _load_embed_cache()
    texts = profile_texts(specs)
    keys = [_text_key(t) if t else None for t in texts]
    todo = sorted({k: t for k, t in zip(keys, texts) if k and k not in cache}.items())

    if todo:
        model = _get_model()
        todo_keys = [k for k, _ in todo]
        todo_texts = [t for _, t in todo]
        vecs = model.encode(todo_texts, normalize_embeddings=True, show_progress_bar=False)
        for k, vec in zip(todo_keys, np.asarray(vecs, dtype=float)):
            cache[k] = vec.tolist()
        EMBED_CACHE.write_text(json.dumps(cache))
        if verbose:
            print(f"  embedded {len(todo)} new description(s)")

    dim = len(next(iter(cache.values()))) if cache else 384
    rows: List[np.ndarray] = []
    for k in keys:
        vec = cache.get(k) if k else None
        rows.append(np.asarray(vec, dtype=float) if vec else np.zeros(dim))
    return np.vstack(rows) if rows else np.zeros((0, dim))


def text_similarity_matrix(embeddings: np.ndarray) -> np.ndarray:
    """(n, n) cosine similarity in [0, 1] from L2-normalized embeddings.

    Zero rows (missing text) yield 0 similarity, contributing no signal.
    """
    sim = embeddings @ embeddings.T
    return np.clip((sim + 1.0) / 2.0, 0.0, 1.0) * (np.linalg.norm(embeddings, axis=1) > 0)[:, None]
