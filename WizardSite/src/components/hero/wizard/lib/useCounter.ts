import { useEffect, useRef, useState } from 'react'

/**
 * Canonical rolling count-up ("odometer") hook. Animates the displayed number to
 * `target` with an easeOutCubic curve whenever `target` changes — counting up from
 * 0 on first mount, then ROLLING from the previously shown value to the next on
 * every change (so a persistent card reads 249 → 199 → … as you scroll through the
 * comparable pairs). `duration <= 0` snaps instantly (used by the reduced-motion
 * fallback, which must not animate).
 */
export function useCounter(target: number, duration = 700) {
  const [value, setValue] = useState(duration <= 0 ? target : 0)
  const from = useRef(duration <= 0 ? target : 0)
  const raf = useRef(0)

  useEffect(() => {
    cancelAnimationFrame(raf.current)

    const start = from.current
    if (duration <= 0 || start === target) {
      setValue(target)
      from.current = target
      return
    }

    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setValue(Math.round(start + (target - start) * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else from.current = target
    }
    raf.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return value
}
