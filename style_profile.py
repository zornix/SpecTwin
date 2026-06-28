"""Normalize marketing descriptions into canonical, brand-agnostic style profiles.

Raw product descriptions are noisy: they repeat the brand/model name, lean on
marketing hyperbole, and restate spec facts already captured elsewhere. Embedding
them directly clusters frames by *brand mention* rather than by *style*.

This module runs each description through a small LLM (the InsForge AI gateway /
OpenRouter) once, rewriting it into a compact, neutral description of the frame's
**aesthetic** — silhouette, vibe, era/style influences, and who it suits — with
the brand and model name stripped out. Those profiles are what ``descsim.py``
embeds.

Profiles are cached in ``style_profiles.json`` keyed by ``source_url`` plus a hash
of the LLM input, so re-runs are free and a changed description regenerates only
that row. If the model/network is unavailable, callers fall back to the raw
description (see ``descsim.profile_texts``).

Generation is parallel (a thread pool of N workers, each owning one LLM call,
since the work is I/O-bound) and crash-safe: the cache is flushed atomically as
results land, so you can stop and resume freely.

Usage:
    python style_profile.py                 # generate/refresh all profiles (parallel)
    python style_profile.py --workers 12    # 12 concurrent LLM calls (default 8)
    python style_profile.py --limit 10      # only the next 10 missing (cost control)
    python style_profile.py --show 3        # print the profile for catalog index 3
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Optional, Sequence

from config import OPENROUTER_BASE_URL, STYLE_PROFILE_MODEL, get_openrouter_key

HERE = Path(__file__).resolve().parent
SPECS_FILE = HERE / "specs.json"
PROFILE_CACHE = HERE / "style_profiles.json"

DEFAULT_WORKERS = 8       # concurrent in-flight LLM calls
FLUSH_EVERY = 20          # write the cache to disk after this many new profiles

_SYSTEM_PROMPT = (
    "You normalize eyewear marketing copy into a neutral STYLE PROFILE used for "
    "similarity matching between sunglasses. Given a product's description and a "
    "few attributes, write 1-2 plain sentences (max ~40 words) describing only the "
    "frame's AESTHETIC: silhouette/shape, overall vibe (e.g. retro, sporty, "
    "minimalist, glamorous, bold, understated), notable design cues, and the wearer "
    "it suits. Rules: do NOT mention the brand or model name. Do NOT use hype words "
    "like 'iconic', 'stylish', 'undeniable', 'impossible to ignore'. Do NOT invent "
    "facts not implied by the input. Output the profile text only, no preamble."
)

_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=get_openrouter_key())
    return _client


def _input_text(spec: dict) -> str:
    """Build the LLM input: the description plus light attribute context to strip."""
    parts = [
        f"Brand: {spec.get('brand') or 'unknown'}",
        f"Model name: {spec.get('product_name') or 'unknown'}",
        f"Shape: {spec.get('shape') or 'unknown'}",
        f"Material: {spec.get('material') or 'unknown'}",
        f"Color: {spec.get('color') or 'unknown'}",
        f"Description: {spec.get('description') or ''}",
    ]
    return "\n".join(parts)


def _input_hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _load_cache() -> dict:
    if PROFILE_CACHE.exists():
        try:
            return json.loads(PROFILE_CACHE.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def _atomic_write_cache(cache: dict) -> None:
    tmp = PROFILE_CACHE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cache, indent=2, ensure_ascii=False))
    os.replace(tmp, PROFILE_CACHE)


def _generate(text: str) -> str:
    resp = _get_client().chat.completions.create(
        model=STYLE_PROFILE_MODEL,
        temperature=0.0,
        max_tokens=120,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


def _pending(specs: Sequence[dict], cache: dict, limit: Optional[int]) -> List[tuple[str, str, str]]:
    """Return (url, input_text, hash) tuples that still need an LLM profile."""
    todo: List[tuple[str, str, str]] = []
    for spec in specs:
        url = spec.get("source_url")
        if not url or not (spec.get("description") or "").strip():
            continue
        text = _input_text(spec)
        h = _input_hash(text)
        entry = cache.get(url)
        if entry and entry.get("input_hash") == h and entry.get("profile"):
            continue
        todo.append((url, text, h))
        if limit is not None and len(todo) >= limit:
            break
    return todo


def build_profiles(
    specs: Sequence[dict],
    limit: Optional[int] = None,
    workers: int = DEFAULT_WORKERS,
    verbose: bool = True,
) -> List[str]:
    """Return a style profile per spec (aligned to ``specs`` order).

    Missing/stale profiles are generated via the LLM **in parallel** (``workers``
    concurrent calls) and cached, flushed atomically as results land so the run is
    resumable. Records without a description yield an empty profile. ``limit`` caps
    how many *new* profiles are generated this run.
    """
    cache = _load_cache()
    todo = _pending(specs, cache, limit)

    if todo:
        if verbose:
            print(f"Generating {len(todo)} profile(s) across {workers} workers...")
        lock = threading.Lock()
        generated = 0

        def work(item: tuple[str, str, str]):
            url, text, h = item
            return url, h, _generate(text)  # may raise — handled by the caller

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(work, item): item for item in todo}
            try:
                for fut in as_completed(futures):
                    url, _, _ = futures[fut]
                    try:
                        url, h, profile = fut.result()
                    except Exception as exc:
                        if verbose:
                            print(f"  [skip] {url} — LLM error: {exc}")
                        continue
                    with lock:
                        cache[url] = {"input_hash": h, "profile": profile}
                        generated += 1
                        if generated % FLUSH_EVERY == 0:
                            _atomic_write_cache(cache)
                    if verbose and (generated % 25 == 0 or generated == len(todo)):
                        print(f"  {generated}/{len(todo)} profiles generated")
            except KeyboardInterrupt:
                if verbose:
                    print("\nInterrupted — flushing partial profiles to disk.")
                pool.shutdown(wait=False, cancel_futures=True)

        _atomic_write_cache(cache)
        if verbose:
            print(f"Wrote {generated} new profile(s) → {PROFILE_CACHE.name}")

    return [(cache.get(s.get("source_url"), {}) or {}).get("profile", "") for s in specs]


def cached_profiles(specs: Sequence[dict]) -> List[str]:
    """Return cached profiles per spec without calling the LLM (missing → "")."""
    cache = _load_cache()
    return [(cache.get(s.get("source_url"), {}) or {}).get("profile", "") for s in specs]


def _load_specs() -> List[dict]:
    return json.loads(SPECS_FILE.read_text()) if SPECS_FILE.exists() else []


def main(argv: List[str]) -> int:
    specs = _load_specs()
    if not specs:
        print("No specs.json — run harvest_listings.py then scrape1.py first.")
        return 1

    def flag(name: str, default=None):
        return argv[argv.index(name) + 1] if name in argv else default

    show = flag("--show")
    if show is not None:
        profiles = cached_profiles(specs)
        i = int(show)
        s = specs[i]
        print(f"[{i}] {s.get('brand')} {s.get('product_name')}")
        print(f"  raw:     {s.get('description')}")
        print(f"  profile: {profiles[i] or '(none — run without --show to generate)'}")
        return 0

    limit = flag("--limit")
    workers = int(flag("--workers", DEFAULT_WORKERS))
    print(f"Building style profiles for {len(specs)} frame(s) via {STYLE_PROFILE_MODEL}...")
    build_profiles(specs, limit=int(limit) if limit else None, workers=workers)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
