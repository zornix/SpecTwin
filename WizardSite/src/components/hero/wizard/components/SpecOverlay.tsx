'use client'

import { useEffect, useMemo, useRef } from 'react'
import { SPECS, DWELL } from '../config'
import { specState, smooth, clamp } from '../lib/scroll'
import { useIsMobile } from '../lib/useMedia'

/**
 * The spec-analysis DOM overlay — a fixed SVG (leader lines + anchor dots) plus a
 * column of mono labels, drawn from the `specState` bridge in its own rAF loop (no
 * per-frame React renders, matching NarrativeOverlay/ProductPanel). During the dwell
 * on the first pair, each leader draws on from its geometry anchor (projected to px by
 * SpecAnnotations) to a fixed label slot in the gap between the frame (left) and the
 * card (right).
 *
 * Two things keep it readable:
 *  • Labels are assigned to column rows SORTED BY ANCHOR HEIGHT (once per dwell), so a
 *    higher anchor always maps to a higher row — the leaders fan out and never cross.
 *  • The draw-on is staggered by row with `drawDur < stagger`, so the lines animate
 *    strictly ONE AT A TIME, top to bottom.
 *
 * Kept monochrome (ink/inkSoft) — a technical spec-sheet read — so it doesn't introduce
 * a second signal color (the single accent stays the cheapest price + CTA).
 */
export function SpecOverlay() {
  const isMobile = useIsMobile()

  // Render only the mobile-flagged specs on narrow screens; keep each spec's ORIGINAL
  // index so we read the right specState.points[i].
  const visible = useMemo(
    () => SPECS.map((s, i) => ({ s, i })).filter(({ s }) => !isMobile || s.mobile),
    [isMobile],
  )

  const lineRefs = useRef<(SVGPathElement | null)[]>([])
  const dotRefs = useRef<(SVGCircleElement | null)[]>([])
  const labelRefs = useRef<(HTMLDivElement | null)[]>([])
  const slots = useRef<{ x: number; y: number }[]>([]) // fixed column row positions
  const rowForP = useRef<number[]>([]) // visible-position p → assigned row (by anchor Y)
  const assigned = useRef(false) // row assignment done for this dwell?

  // Fixed column of row positions (center gap on desktop, left margin on mobile).
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const n = visible.length
      const colX = isMobile ? 22 : Math.min(w * 0.52, w - 380)
      const gap = isMobile ? 54 : 64
      const top = h * (isMobile ? 0.3 : 0.5) - ((n - 1) * gap) / 2
      slots.current = Array.from({ length: n }, (_, r) => ({ x: colX, y: top + r * gap }))
      assigned.current = false // re-place labels against the new column next frame
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [visible, isMobile])

  // Draw loop: assign rows by anchor height once, then connect + stagger by row.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const reveal = specState.reveal

      if (reveal <= 0.001) {
        // Dwell not active — hide everything and allow a fresh assignment next time.
        assigned.current = false
        for (let p = 0; p < visible.length; p++) {
          hide(lineRefs.current[p], dotRefs.current[p], labelRefs.current[p])
        }
        raf = requestAnimationFrame(tick)
        return
      }

      // Assign each label to a row sorted by its anchor's screen Y (top anchor → top
      // row) — done once per dwell, while the camera holds, so leaders can't cross.
      if (!assigned.current) {
        const ready = visible.every(({ i }) => specState.points[i]?.on) && slots.current.length
        if (ready) {
          const order = visible.map((_, p) => p)
          order.sort((a, b) => specState.points[visible[a].i].y - specState.points[visible[b].i].y)
          const rows: number[] = []
          order.forEach((p, row) => (rows[p] = row))
          rowForP.current = rows
          // Pin each label DOM node to its assigned row.
          for (let p = 0; p < visible.length; p++) {
            const el = labelRefs.current[p]
            const slot = slots.current[rows[p]]
            if (el && slot) {
              el.style.left = `${slot.x}px`
              el.style.top = `${slot.y}px`
            }
          }
          assigned.current = true
        }
      }
      if (!assigned.current) {
        raf = requestAnimationFrame(tick)
        return
      }

      // Sequential draws finish by reveal ≈0.68 (5 rows), then HOLD, then clear as the
      // dolly resumes — so every line gets visible time, including the last.
      const group = fadeIn(reveal, 0, 0.06) * fadeOut(reveal, 0.9, 1)

      for (let p = 0; p < visible.length; p++) {
        const { i } = visible[p]
        const pt = specState.points[i]
        const row = rowForP.current[p]
        const slot = slots.current[row]
        const line = lineRefs.current[p]
        const dot = dotRefs.current[p]
        const label = labelRefs.current[p]
        if (!line || !dot || !label || !slot) continue

        if (!pt || !pt.on || group <= 0.001) {
          hide(line, dot, label)
          continue
        }

        // Stagger by ROW → strictly one at a time, top to bottom.
        const local = smooth(clamp((reveal - row * DWELL.stagger) / DWELL.drawDur))
        const ax = pt.x
        const ay = pt.y
        const { x: lx, y: ly } = slot
        const L = Math.hypot(lx - ax, ly - ay)

        line.setAttribute('d', `M ${ax.toFixed(1)} ${ay.toFixed(1)} L ${lx.toFixed(1)} ${ly.toFixed(1)}`)
        line.setAttribute('stroke-dasharray', `${L.toFixed(1)}`)
        line.setAttribute('stroke-dashoffset', `${(L * (1 - local)).toFixed(1)}`)
        line.style.opacity = `${group.toFixed(3)}`

        dot.setAttribute('cx', `${ax.toFixed(1)}`)
        dot.setAttribute('cy', `${ay.toFixed(1)}`)
        dot.setAttribute('r', `${(2.6 * local).toFixed(2)}`)
        dot.style.opacity = `${group.toFixed(3)}`

        label.style.opacity = `${(local * group).toFixed(3)}`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible])

  return (
    <div className="spec-overlay" aria-hidden="true">
      <svg className="spec-svg">
        {visible.map(({ s }, p) => (
          <g key={s.key}>
            <path ref={(el) => { lineRefs.current[p] = el }} className="spec-leader" fill="none" />
            <circle ref={(el) => { dotRefs.current[p] = el }} className="spec-dot" r="0" />
          </g>
        ))}
      </svg>
      {visible.map(({ s }, p) => (
        <div key={s.key} className="spec-label" ref={(el) => { labelRefs.current[p] = el }}>
          <div className="spec-label-name">{s.label}</div>
          <div className="spec-label-value">{s.value}</div>
        </div>
      ))}
    </div>
  )
}

const fadeIn = (x: number, a: number, b: number) => smooth(clamp((x - a) / (b - a)))
const fadeOut = (x: number, a: number, b: number) => 1 - smooth(clamp((x - a) / (b - a)))

function hide(
  line: SVGPathElement | null,
  dot: SVGCircleElement | null,
  label: HTMLDivElement | null,
) {
  if (line) line.style.opacity = '0'
  if (dot) dot.style.opacity = '0'
  if (label) label.style.opacity = '0'
}
