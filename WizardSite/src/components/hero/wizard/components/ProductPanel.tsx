'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildProducts, STACK, INSTANCES } from '../config'
import { scrollState, sectionFloat } from '../lib/scroll'
import { useIsMobile } from '../lib/useMedia'
import { ProductCard } from './ProductCard'

/**
 * The right-side product panel — ONE persistent shadcn card, fixed in place, whose
 * fields update as you scroll. A single rAF loop maps scroll.offset onto the
 * comparable-pairs range and picks the centered pair; when that index changes the
 * card's price/discount ROLL to the new pair (see ProductCard / useCounter) so the
 * same card visibly counts down through the cheaper look-alikes. The card fades in
 * once the vertical pairs begin and stays for the rest of the scroll.
 *
 * State is written via functional setState that BAILS when unchanged, so the rAF
 * loop only triggers a React render on an actual index/visibility change — not
 * every frame.
 */
export function ProductPanel() {
  const isMobile = useIsMobile()
  const count = isMobile ? INSTANCES.mobile : INSTANCES.desktop
  const products = useMemo(() => buildProducts(count), [count])

  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const off = scrollState.offset
      const entered = off > STACK.sections[0] - 0.015
      setVisible((v) => (v === entered ? v : entered))

      // Which pair is centered → which product the persistent card shows. Shares
      // sectionFloat with the camera, so it holds on pair 0 through the spec dwell.
      const sf = sectionFloat(off, count)
      const idx = Math.min(count - 1, Math.max(0, Math.round(sf)))
      setIndex((p) => (p === idx ? p : idx))

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [count])

  const product = products[index]

  return (
    <div className="cards-panel">
      <div className="card-persist" data-visible={visible}>
        {/* Mount only once visible so price / discount / match-score all roll up
            from 0 the first time you scroll into the pairs (and again on re-entry). */}
        {visible && (
          <ProductCard
            product={product}
            cheapest={index === count - 1}
            index={index}
            total={count}
          />
        )}
      </div>
    </div>
  )
}
