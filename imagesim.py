"""CLIP image embeddings for visual similarity between sunglasses photos.

Downloads each product's primary image, embeds it with a CLIP model
(``clip-ViT-B-32`` via sentence-transformers), and caches both the image bytes
and the embedding so re-runs are cheap. Products whose image can't be fetched or
embedded get a zero vector and simply contribute no visual signal.

This module is optional: ``match.py`` falls back to spec-only matching when the
model or network is unavailable.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import List, Optional, Sequence

import numpy as np

HERE = Path(__file__).resolve().parent
IMAGE_CACHE = HERE / "image_cache"
EMBED_CACHE = HERE / "clip_embeddings.json"
MODEL_NAME = "clip-ViT-B-32"

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(MODEL_NAME)
    return _model


def _cache_key(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()


def _download(url: str) -> Optional[Path]:
    IMAGE_CACHE.mkdir(exist_ok=True)
    path = IMAGE_CACHE / f"{_cache_key(url)}.img"
    if path.exists() and path.stat().st_size > 0:
        return path
    import requests

    try:
        resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        path.write_bytes(resp.content)
        return path
    except Exception:
        return None


def _load_embed_cache() -> dict:
    if EMBED_CACHE.exists():
        try:
            return json.loads(EMBED_CACHE.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def embed_specs(specs: Sequence[dict], verbose: bool = True) -> np.ndarray:
    """Return an (n, d) L2-normalized CLIP embedding matrix for the catalog.

    Embeddings are cached by image URL in ``clip_embeddings.json``; rows whose
    image is missing or fails to embed are left as zeros.
    """
    from PIL import Image

    cache = _load_embed_cache()
    urls = [(s.get("image_urls") or [None])[0] for s in specs]
    todo = [u for u in urls if u and u not in cache]

    if todo:
        model = _get_model()
        for i, url in enumerate(todo, 1):
            path = _download(url)
            if path is None:
                continue
            try:
                with Image.open(path) as im:
                    vec = model.encode(im.convert("RGB"), normalize_embeddings=True)
                cache[url] = np.asarray(vec, dtype=float).tolist()
            except Exception:
                continue
            if verbose and (i % 25 == 0 or i == len(todo)):
                print(f"  embedded {i}/{len(todo)} new images")
        EMBED_CACHE.write_text(json.dumps(cache))

    dim = len(next(iter(cache.values()))) if cache else 512
    rows: List[np.ndarray] = []
    for url in urls:
        vec = cache.get(url) if url else None
        rows.append(np.asarray(vec, dtype=float) if vec else np.zeros(dim))
    return np.vstack(rows) if rows else np.zeros((0, dim))


def image_similarity_matrix(embeddings: np.ndarray) -> np.ndarray:
    """(n, n) cosine similarity in [0, 1] from L2-normalized embeddings.

    Zero rows (missing images) yield 0 similarity, contributing no signal.
    """
    sim = embeddings @ embeddings.T
    return np.clip((sim + 1.0) / 2.0, 0.0, 1.0) * (np.linalg.norm(embeddings, axis=1) > 0)[:, None]
