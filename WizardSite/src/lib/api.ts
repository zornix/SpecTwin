import "server-only";

import { findMatches } from "./matcher";
import { resolveSource } from "./mock-data";
import type { MatchResponse } from "./types";

/**
 * Single seam for "given a product URL, return a source + cheaper matches".
 *
 * If MATCHING_SERVICE_URL is set we proxy to the FastAPI service; otherwise we
 * run the local TypeScript matcher. Both return an identical MatchResponse, so
 * the rest of the app never needs to know which engine answered.
 *
 * Used by both the Results/Compare server components and the /api/match route,
 * so the resolution logic lives in exactly one place.
 */
export async function getMatches(url: string): Promise<MatchResponse> {
  const serviceUrl = process.env.MATCHING_SERVICE_URL?.replace(/\/$/, "");

  if (serviceUrl) {
    try {
      const res = await fetch(`${serviceUrl}/match`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
        // POST isn't cached by the Data Cache; be explicit rather than rely on
        // a `revalidate` that doesn't apply to non-GET fetches.
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`FastAPI responded ${res.status}`);
      const data = (await res.json()) as MatchResponse;
      return { ...data, engine: "fastapi" };
    } catch (err) {
      // Never let a down Python service break the UI — fall back to local.
      console.error("[getMatches] FastAPI proxy failed, using local matcher:", err);
    }
  }

  const source = resolveSource(url);
  const matches = findMatches(source);
  return { source, matches, engine: "local-ts" };
}
