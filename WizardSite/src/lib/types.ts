/**
 * Core domain types for WizardSite.
 *
 * These mirror `service/models.py` 1:1 so the Next.js local matcher and the
 * FastAPI service are interchangeable behind `getMatches()` (see lib/api.ts).
 */

export type FrameShape =
  | "wayfarer"
  | "aviator"
  | "round"
  | "rectangle"
  | "cat-eye"
  | "square"
  | "sport"
  | "oval";

export type FrameMaterial =
  | "acetate"
  | "metal"
  | "titanium"
  | "injected"
  | "tr90"
  | "mixed";

export type LensMaterial = "polycarbonate" | "glass" | "nylon" | "cr39";

export type Fit = "narrow" | "medium" | "wide";

export interface Sunglasses {
  id: string;
  brand: string;
  model: string;
  retailer: string;
  /** Absolute product URL at the retailer. */
  productUrl: string;
  /** Remote image (see next.config images.remotePatterns) or local fallback. */
  imageUrl: string;
  price: number;
  currency: string;
  shape: FrameShape;
  frameMaterial: FrameMaterial;
  lensMaterial: LensMaterial;
  /** Lens width in millimetres (the first number in a 52□18-145 spec). */
  lensWidthMm: number;
  /** Bridge width in millimetres. */
  bridgeMm: number;
  /** Temple (arm) length in millimetres. */
  templeMm: number;
  polarized: boolean;
  /** e.g. "UV400" / "100% UVA/UVB". */
  uvProtection: string;
  color: string;
  fit: Fit;
  /** Short marketing blurb shown on cards / detail. */
  blurb?: string;
}

/** Per-spec breakdown of how a match compares to the source. */
export interface SpecComparison {
  label: string;
  source: string;
  match: string;
  /** Weight this spec carried in the score (0–1). */
  weight: number;
  /** Whether this spec is considered a match. */
  aligned: boolean;
}

export interface SunglassMatch extends Sunglasses {
  /** Overall similarity to the source, 0–100. */
  matchScore: number;
  /** Absolute money saved vs the source price (>= 0). */
  savings: number;
  /** Percentage saved vs the source price, 0–100. */
  savingsPct: number;
  /** Spec-by-spec comparison used to explain the score. */
  comparison: SpecComparison[];
}

export interface MatchResponse {
  /** The product resolved from the pasted URL. */
  source: Sunglasses;
  /** Cheaper, spec-similar alternatives, best first. */
  matches: SunglassMatch[];
  /** Where the result came from — useful for the methodology/debug. */
  engine: "local-ts" | "fastapi";
}
