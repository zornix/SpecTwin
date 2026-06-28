"""FastAPI matching service for Spectra.

A thin stand-in for the future Python matching pipeline. The Next.js app proxies
to this when MATCHING_SERVICE_URL is set; otherwise it uses its local TS matcher.
Both return an identical MatchResponse shape.

Run locally:
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from matcher import find_matches
from mock_data import resolve_source
from models import MatchRequest, MatchResponse

app = FastAPI(title="Spectra Matching Service", version="0.1.0")

# Allow the Next.js dev server (and a configurable origin) to call us directly.
allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins] or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "spectra-matching"}


@app.post("/match", response_model=MatchResponse)
def match(req: MatchRequest) -> MatchResponse:
    source = resolve_source(req.url)
    matches = find_matches(source)
    return MatchResponse(source=source, matches=matches, engine="fastapi")
