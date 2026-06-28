"""CLIP image embeddings for visual similarity between sunglasses photos.

Downloads each product's primary image, embeds it with a CLIP model
(``clip-ViT-B-32`` via sentence-transformers), and caches both the image bytes
and the embedding so re-runs are cheap. Products whose image can't be fetched or
embedded get a zero vector and simply contribute no visual signal.

This module is optional: ``match.py`` falls back to spec-only matching when the
model or network is unavailable.

Backfilling the whole catalog is parallel: image downloads (I/O-bound) run across
a thread pool and the CLIP encode runs in batches, with the embedding cache
flushed atomically as batches land so the run is resumable. You can also drive it
standalone:

    python imagesim.py                  # embed every catalog image (parallel)
    python imagesim.py --workers 32     # more concurrent downloads (default 16)
    python imagesim.py --batch-size 128 # larger CLIP encode batches (default 64)
    python imagesim.py --limit 200      # only the next 200 missing (cost/time cap)
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Optional, Sequence

import numpy as np

HERE = Path(__file__).resolve().parent
IMAGE_CACHE = HERE / "image_cache"
EMBED_CACHE = HERE / "clip_embeddings.json"
MODEL_NAME = "clip-ViT-B-32"

DEFAULT_WORKERS = 16     # concurrent image downloads (I/O-bound)
DEFAULT_BATCH = 64       # images encoded per CLIP forward pass
FLUSH_EVERY = 5          # flush the cache to disk every N encoded batches

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


def _atomic_write_cache(cache: dict) -> None:
    tmp = EMBED_CACHE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cache))
    os.replace(tmp, EMBED_CACHE)


def _download_many(urls: Sequence[str], workers: int, verbose: bool) -> dict:
    """Download ``urls`` concurrently, returning {url: local_path} for successes."""
    paths: dict[str, Path] = {}
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_download, u): u for u in urls}
        for fut in as_completed(futures):
            url = futures[fut]
            done += 1
            try:
                path = fut.result()
            except Exception:
                path = None
            if path is not None:
                paths[url] = path
            if verbose and (done % 50 == 0 or done == len(urls)):
                print(f"  downloaded {done}/{len(urls)} images ({len(paths)} ok)")
    return paths


def embed_specs(
    specs: Sequence[dict],
    verbose: bool = True,
    workers: int = DEFAULT_WORKERS,
    batch_size: int = DEFAULT_BATCH,
    limit: Optional[int] = None,
) -> np.ndarray:
    """Return an (n, d) L2-normalized CLIP embedding matrix for the catalog.

    Missing embeddings are filled in parallel: images are downloaded across a
    thread pool, then CLIP-encoded in batches with the cache flushed atomically as
    batches land (so the run is resumable). Embeddings are cached by image URL in
    ``clip_embeddings.json``; rows whose image is missing or fails to embed are
    left as zeros. ``limit`` caps how many *new* images are embedded this run.
    """
    from PIL import Image

    cache = _load_embed_cache()
    urls = [(s.get("image_urls") or [None])[0] for s in specs]
    todo = list(dict.fromkeys(u for u in urls if u and u not in cache))
    if limit is not None:
        todo = todo[:limit]

    if todo:
        model = _get_model()
        if verbose:
            print(f"Embedding {len(todo)} new image(s): downloading via {workers} workers...")
        paths = _download_many(todo, workers=workers, verbose=verbose)

        ready = [u for u in todo if u in paths]
        encoded = 0
        for start in range(0, len(ready), batch_size):
            chunk = ready[start : start + batch_size]
            images, keep = [], []
            for url in chunk:
                try:
                    with Image.open(paths[url]) as im:
                        images.append(im.convert("RGB"))
                    keep.append(url)
                except Exception:
                    continue
            if not images:
                continue
            vecs = model.encode(images, batch_size=len(images), normalize_embeddings=True)
            for url, vec in zip(keep, np.asarray(vecs, dtype=float)):
                cache[url] = vec.tolist()
            encoded += len(keep)
            batch_no = start // batch_size + 1
            if batch_no % FLUSH_EVERY == 0:
                _atomic_write_cache(cache)
            if verbose:
                print(f"  encoded {encoded}/{len(ready)} images")
        _atomic_write_cache(cache)
        if verbose:
            print(f"Wrote {encoded} new embedding(s) → {EMBED_CACHE.name}")

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


def _load_specs() -> List[dict]:
    specs_file = HERE / "specs.json"
    return json.loads(specs_file.read_text()) if specs_file.exists() else []


def main(argv: List[str]) -> int:
    specs = _load_specs()
    if not specs:
        print("No specs.json — run harvest_listings.py then scrape1.py first.")
        return 1

    def flag(name: str, default=None):
        return argv[argv.index(name) + 1] if name in argv else default

    workers = int(flag("--workers", DEFAULT_WORKERS))
    batch_size = int(flag("--batch-size", DEFAULT_BATCH))
    limit = flag("--limit")

    embeddings = embed_specs(
        specs,
        workers=workers,
        batch_size=batch_size,
        limit=int(limit) if limit else None,
    )
    have = int((np.linalg.norm(embeddings, axis=1) > 0).sum())
    print(f"Catalog now has CLIP embeddings for {have}/{len(specs)} frame(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
