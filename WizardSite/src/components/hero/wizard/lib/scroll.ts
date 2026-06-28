/**
 * Scroll math helpers. Everything binds to ScrollControls' `scroll.offset` (0→1),
 * so these are pure functions of that single value — no hand-rolled scroll listeners.
 */

import { STACK, DWELL, SPECS } from '../config'

export type Range = readonly [number, number]

/** Clamp x into [min, max]. */
export const clamp = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x))

/**
 * Local progress of `offset` within a beat's [start, end] range, clamped to 0→1.
 * Before the beat → 0, after → 1. This is the workhorse for per-beat animation.
 */
export const beatProgress = (offset: number, [start, end]: Range) =>
  clamp((offset - start) / (end - start || 1))

/** Smootherstep (Ken Perlin) — eased 0→1, zero first/second derivative at ends.
 *  Use to soften a linear progress without overshoot. */
export const smooth = (t: number) => {
  const x = clamp(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** Triangular "window" that ramps 0→1→0 across a range, peaking at its center.
 *  Used for transient effects like the emissive flash during the erase. */
export const pulse = (offset: number, [start, end]: Range) => {
  const t = beatProgress(offset, [start, end])
  return 1 - Math.abs(t * 2 - 1)
}

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * THE single source of truth for "which comparable pair is centered" — a float in
 * [0, count-1] mapped from scroll.offset across STACK.sections. It carves a DWELL at
 * the very start (offset stays pinned at pair 0 for `DWELL.span`) so the camera can
 * hold while the spec callouts draw on, then maps the remainder linearly. BOTH the
 * camera (Experience) and the price card (ProductPanel) read this, so they cannot
 * desync. The branches meet at 0 where they join (dwellEnd) → no jump; reaches
 * count-1 at sections[1].
 */
export const sectionFloat = (offset: number, count: number) => {
  const [s0, s1] = STACK.sections
  const dwellEnd = s0 + DWELL.span
  if (offset <= dwellEnd) return 0 // HOLD on pair 0 while specs analyze
  return clamp((offset - dwellEnd) / (s1 - dwellEnd)) * (count - 1)
}

/** Progress through the spec-analysis dwell window: 0 at sections start → 1 at dwellEnd. */
export const dwellProgress = (offset: number) =>
  clamp((offset - STACK.sections[0]) / DWELL.span)

/**
 * Shared scroll offset bridge. ScrollControls' scroll state only exists *inside*
 * the Canvas, but the text overlay is a DOM layer *outside* it. A tiny in-canvas
 * driver writes `scrollState.offset` each frame; the overlay reads it from its own
 * rAF loop and mutates DOM styles directly — so we sync both without re-rendering
 * React every frame.
 */
export const scrollState = { offset: 0 }

/**
 * Spec-analysis bridge. An in-canvas projector (SpecAnnotations) projects the first
 * pair's geometry anchors to SCREEN pixels each frame and writes them here along with
 * the reveal gate; the DOM SpecOverlay reads it from its own rAF loop and draws the
 * leader lines + labels — same canvas→DOM pattern as `scrollState`.
 *   reveal  — 0→1 gate for the draw-on (gated by entrance + dwellProgress)
 *   points  — one per SPECS entry: anchor in CSS px, `on=false` if behind the camera
 */
export const specState = {
  reveal: 0,
  // One slot per spec (SPECS order), pre-sized so readers never see a partial array.
  points: SPECS.map(() => ({ x: 0, y: 0, on: false })),
}
