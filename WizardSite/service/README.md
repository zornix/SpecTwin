# Spectra Matching Service (FastAPI)

A thin Python stand-in for the future matching pipeline. The Next.js app proxies
to it when `MATCHING_SERVICE_URL` is set; otherwise it falls back to the local
TypeScript matcher. Both return an identical `MatchResponse`.

`models.py`, `mock_data.py` and `matcher.py` intentionally mirror their
TypeScript counterparts in `../src/lib/`.

## Run locally

```bash
cd service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then point the web app at it (from the repo root):

```bash
echo "MATCHING_SERVICE_URL=http://localhost:8000" >> .env.local
# restart `pnpm dev`
```

## Endpoints

- `GET /health` → `{ "status": "ok" }`
- `POST /match` → body `{ "url": "https://…" }` → `MatchResponse`

```bash
curl -s -X POST http://localhost:8000/match \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.ray-ban.com/usa/sunglasses/RB2140"}' | jq
```
