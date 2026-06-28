import { CATALOG } from "./mock-data";
import type {
  SpecComparison,
  Sunglasses,
  SunglassMatch,
} from "./types";

/**
 * Weighted spec-similarity matcher.
 *
 * Each spec contributes a 0–1 similarity, scaled by its weight; the weighted
 * average becomes a 0–100 `matchScore`. The weights are intentionally surfaced
 * on the /methodology page, so keep them in sync there.
 *
 * `service/matcher.py` mirrors this logic for the FastAPI engine.
 */
export const SPEC_WEIGHTS = {
  shape: 0.26,
  fit: 0.16,
  lensWidth: 0.16,
  polarized: 0.14,
  frameMaterial: 0.12,
  lensMaterial: 0.08,
  uv: 0.05,
  color: 0.03,
} as const;

/** Shapes that read as visually similar get partial credit. */
const SHAPE_NEIGHBORS: Record<string, string[]> = {
  wayfarer: ["square", "rectangle"],
  square: ["wayfarer", "rectangle"],
  rectangle: ["square", "wayfarer"],
  aviator: ["round", "oval"],
  round: ["oval", "aviator"],
  oval: ["round", "aviator"],
  "cat-eye": ["round", "oval"],
  sport: ["square"],
};

const FIT_ORDER = ["narrow", "medium", "wide"] as const;

function shapeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (SHAPE_NEIGHBORS[a]?.includes(b)) return 0.6;
  return 0.1;
}

function fitSimilarity(a: string, b: string): number {
  const d = Math.abs(FIT_ORDER.indexOf(a as never) - FIT_ORDER.indexOf(b as never));
  return d === 0 ? 1 : d === 1 ? 0.55 : 0.15;
}

/** Tolerance-based numeric similarity (mm). */
function mmSimilarity(a: number, b: number, tolerance = 8): number {
  const diff = Math.abs(a - b);
  return Math.max(0, 1 - diff / tolerance);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function buildComparison(
  source: Sunglasses,
  candidate: Sunglasses,
): SpecComparison[] {
  const shapeSim = shapeSimilarity(source.shape, candidate.shape);
  const fitSim = fitSimilarity(source.fit, candidate.fit);
  const lensSim = mmSimilarity(source.lensWidthMm, candidate.lensWidthMm);
  return [
    {
      label: "Frame shape",
      source: source.shape,
      match: candidate.shape,
      weight: SPEC_WEIGHTS.shape,
      aligned: shapeSim >= 0.6,
    },
    {
      label: "Fit",
      source: source.fit,
      match: candidate.fit,
      weight: SPEC_WEIGHTS.fit,
      aligned: fitSim >= 0.55,
    },
    {
      label: "Lens width",
      source: `${source.lensWidthMm}mm`,
      match: `${candidate.lensWidthMm}mm`,
      weight: SPEC_WEIGHTS.lensWidth,
      aligned: lensSim >= 0.5,
    },
    {
      label: "Polarized",
      source: source.polarized ? "Yes" : "No",
      match: candidate.polarized ? "Yes" : "No",
      weight: SPEC_WEIGHTS.polarized,
      aligned: source.polarized === candidate.polarized,
    },
    {
      label: "Frame material",
      source: source.frameMaterial,
      match: candidate.frameMaterial,
      weight: SPEC_WEIGHTS.frameMaterial,
      aligned: source.frameMaterial === candidate.frameMaterial,
    },
    {
      label: "Lens material",
      source: source.lensMaterial,
      match: candidate.lensMaterial,
      weight: SPEC_WEIGHTS.lensMaterial,
      aligned: source.lensMaterial === candidate.lensMaterial,
    },
    {
      label: "UV protection",
      source: source.uvProtection,
      match: candidate.uvProtection,
      weight: SPEC_WEIGHTS.uv,
      aligned: source.uvProtection === candidate.uvProtection,
    },
  ];
}

function scoreCandidate(source: Sunglasses, candidate: Sunglasses): number {
  const sims = {
    shape: shapeSimilarity(source.shape, candidate.shape),
    fit: fitSimilarity(source.fit, candidate.fit),
    lensWidth: mmSimilarity(source.lensWidthMm, candidate.lensWidthMm),
    polarized: source.polarized === candidate.polarized ? 1 : 0,
    frameMaterial: source.frameMaterial === candidate.frameMaterial ? 1 : 0.35,
    lensMaterial: source.lensMaterial === candidate.lensMaterial ? 1 : 0.4,
    uv: source.uvProtection === candidate.uvProtection ? 1 : 0.5,
    color: source.color.toLowerCase().split(" ")[0] ===
      candidate.color.toLowerCase().split(" ")[0]
      ? 1
      : 0.3,
  };

  let total = 0;
  for (const key of Object.keys(SPEC_WEIGHTS) as Array<keyof typeof SPEC_WEIGHTS>) {
    total += clamp01(sims[key]) * SPEC_WEIGHTS[key];
  }
  return Math.round(total * 100);
}

export interface MatchOptions {
  /** Only return candidates strictly cheaper than the source. Default true. */
  cheaperOnly?: boolean;
  /** Drop weak matches below this score. Default 35. */
  minScore?: number;
  /** Cap the number of results. Default 12. */
  limit?: number;
}

/**
 * Score every catalog item against the source and return the best, cheaper
 * alternatives first (sorted by score, then savings).
 */
export function findMatches(
  source: Sunglasses,
  options: MatchOptions = {},
): SunglassMatch[] {
  const { cheaperOnly = true, minScore = 35, limit = 12 } = options;

  return CATALOG.filter((c) => c.id !== source.id)
    .filter((c) => (cheaperOnly ? c.price < source.price : true))
    .map<SunglassMatch>((candidate) => {
      const matchScore = scoreCandidate(source, candidate);
      const savings = Math.max(0, source.price - candidate.price);
      const savingsPct = source.price
        ? Math.round((savings / source.price) * 100)
        : 0;
      return {
        ...candidate,
        matchScore,
        savings,
        savingsPct,
        comparison: buildComparison(source, candidate),
      };
    })
    .filter((m) => m.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore || b.savings - a.savings)
    .slice(0, limit);
}
