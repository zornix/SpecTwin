'use client'

import { useEffect, useRef } from 'react'
import { BEATS, STACK } from '../config'
import { scrollState, clamp, smooth } from '../lib/scroll'

/**
 * The narrative text layer — a DOM layer above the canvas, pinned to scroll beats
 * via a single rAF loop reading the shared scroll bridge (scrollState.offset).
 *
 *   HERO   → "Every frame has a twin." title card, up top, before you scroll in
 *   ERASE  → "We read the specs, not the logo." as the logo dissolves in 3D
 *   PAIRS  → "Meet the twins." pins while the price/score card counts down
 *   END    → the call to action
 */
export function NarrativeOverlay() {
  const heroRef = useRef<HTMLDivElement>(null)
  const cueRef = useRef<HTMLDivElement>(null)
  const eraseRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const [, heroEnd] = BEATS.hero // 0.12
    const [eraseStart, eraseEnd] = BEATS.erase // 0.12 → 0.30
    const [s0] = STACK.sections // 0.34

    let raf = 0
    const tick = () => {
      const off = scrollState.offset

      // HERO — the title owns the first screen, then lifts away as you scroll in.
      place(heroRef.current, fadeOut(off, heroEnd - 0.06, heroEnd), 26)
      place(cueRef.current, fadeOut(off, 0.015, 0.05), 0)

      // ERASE — appears with the logo dissolve, clears as it finishes.
      place(
        eraseRef.current,
        band(off, eraseStart + 0.03, eraseStart + 0.08, eraseEnd - 0.05, eraseEnd),
        18,
      )

      // PAIRS — the thesis pins once the vertical pairs begin.
      place(pinRef.current, fadeIn(off, s0 + 0.02, s0 + 0.09), 18)

      // END — CTA resolves on the last pair.
      placeCta(ctaRef.current, fadeIn(off, 0.9, 0.965), 16)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="se-narr" aria-hidden="true">
      {/* HERO — title card, up top, before the glasses. */}
      <div className="se-hero" ref={heroRef}>
        <h1 className="se-hero-title">
          Every frame
          <br />
          has a <em>twin</em>.
        </h1>
        <p className="se-hero-sub">
          Designer optics have cheaper twins — matched to the millimetre.
          Scroll to meet them.
        </p>
      </div>

      <div className="se-cue" ref={cueRef}>
        <span className="se-cue-line" />
        Scroll
      </div>

      {/* ERASE — what the dissolve means. */}
      <div className="se-erase" ref={eraseRef}>
        <p>
          We read the specs,
          <br />
          <em>not the logo.</em>
        </p>
      </div>

      {/* PAIRS — pinned thesis while the card counts down. */}
      <div className="se-pin" ref={pinRef}>
        <h2>Realtime AI matching.</h2>
        <p className="se-pin-sub">
          Measurements, image and style — three signals, scored across 1,500+
          frames.
        </p>
      </div>

      {/* END — call to action. */}
      <a className="se-cta" ref={ctaRef} href="/results">
        Find your twin <span aria-hidden="true">→</span>
      </a>
    </div>
  )
}

/* ── eased fade + rise helpers ──────────────────────────────────────────────── */

const fadeIn = (off: number, a: number, b: number) => smooth(clamp((off - a) / (b - a)))
const fadeOut = (off: number, a: number, b: number) => 1 - smooth(clamp((off - a) / (b - a)))
const band = (off: number, a: number, b: number, c: number, d: number) =>
  fadeIn(off, a, b) * fadeOut(off, c, d)

/** Set opacity + a rise (exposed as --rise so it composes with each block's base
 *  centering transform defined in wizard.css — never overwriting it). */
function place(el: HTMLElement | null, o: number, dy: number) {
  if (!el) return
  el.style.opacity = o.toFixed(3)
  el.style.setProperty('--rise', `${((1 - o) * dy).toFixed(1)}px`)
}

function placeCta(el: HTMLElement | null, o: number, dy: number) {
  if (!el) return
  place(el, o, dy)
  el.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
}
