"""FastAPI matching service for WizardSite.

Wraps the repo-root recommendation engine (see ``engine.py``) behind the
``MatchResponse`` contract the Next.js app expects. The app proxies here when
``MATCHING_SERVICE_URL`` is set; otherwise it uses its built-in TS matcher.

Given a sunglasses product URL that is already in ``specs.json``, returns the
reference frame plus its top cheaper, spec-similar look-alikes — each carrying
brand/model, price, link, image and a 0–100 match score.

Run locally (from this folder):
    uvicorn main:app --port 8000
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import engine
from models import MatchRequest, MatchResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Build the catalog + similarity matrix once, up front, so the first request
    # isn't slow. Don't crash the server if the catalog can't load — /match will
    # surface the error per request.
    try:
        size = engine.warm()
        print(f"[wizardsite] catalog ready: {size} frames, mode={engine.MATCH_MODE}")
    except Exception as exc:  # noqa: BLE001
        print(f"[wizardsite] WARNING: catalog warmup failed: {exc}")
    yield


app = FastAPI(title="WizardSite Matching Service", version="1.0.0", lifespan=lifespan)

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins] or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "wizardsite-matching"}


@app.post("/match", response_model=MatchResponse)
def match(req: MatchRequest) -> MatchResponse:
    try:
        result = engine.match_url(req.url)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"matching failed: {exc}") from exc
    if result is None:
        # Not in the catalog — let the Next.js app fall back to its local matcher.
        raise HTTPException(
            status_code=404,
            detail="No catalog item matches that URL.",
        )
    return result
