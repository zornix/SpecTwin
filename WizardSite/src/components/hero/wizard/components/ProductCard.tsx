'use client'

import { cn } from '@/lib/utils'
import { useCounter } from '../lib/useCounter'
import { CARD, type Product } from '../config'

type Props = {
  product: Product
  cheapest?: boolean
  /** 1-based position + total, shown as a "01 / 06" progress read. Optional. */
  index?: number
  total?: number
  /** 0 = snap instantly (reduced motion). Otherwise the price/discount/score roll. */
  duration?: number
}

/**
 * The persistent product card, styled in the Spectwin system (hairline borders,
 * Geist Mono numerals, orange signal). Price, discount AND the new match-accuracy
 * score ROLL (easeOutCubic odometer) from the previous pair's values to the new
 * ones whenever `product` changes, so the single card reads as one frame getting
 * cheaper — and its twin getting more certain — as you scroll. The brand label and
 * the score flash on change.
 */
export function ProductCard({ product, cheapest, index, total, duration = 700 }: Props) {
  const price = useCounter(product.price, duration)
  const discount = useCounter(product.discount, duration)
  const score = useCounter(product.score, duration)

  return (
    <div
      className={cn(
        'w-[272px] bg-card shadow-[0_24px_60px_-22px_rgba(20,17,13,0.4)]',
        cheapest ? 'border-2 border-primary' : 'border border-border',
      )}
    >
      {/* Brand + discount */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <span key={product.brand} className="brand-swap label-mono text-foreground">
          {product.brand}
        </span>
        <span
          className={cn(
            'label-mono px-2 py-1 tabular-nums',
            cheapest ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          −{discount}%
        </span>
      </div>

      {/* Price */}
      <div className="px-5 pt-5">
        <div
          className={cn(
            'font-mono text-5xl font-semibold leading-none tabular-nums transition-colors',
            cheapest ? 'text-accent' : 'text-foreground',
          )}
        >
          ${price}
        </div>
        <div className="label-mono mt-2 text-muted-foreground">
          vs <s>${CARD.original}</s> designer
        </div>
      </div>

      {/* Match-accuracy score — rolls + flashes orange, with a slim meter. */}
      <div className="mt-5 border-t border-border px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="label-mono text-muted-foreground">Match accuracy</span>
          <span
            key={product.score}
            className="match-flash font-mono text-3xl font-semibold leading-none tabular-nums text-accent"
          >
            {score}%
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden bg-muted">
          <div className="h-full bg-primary" style={{ width: `${score}%` }} />
        </div>
      </div>

      {/* Position read */}
      {index != null && total != null && (
        <div className="flex justify-end border-t border-border px-5 py-2.5">
          <span className="label-mono tabular-nums text-muted-foreground/70">
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>
      )}
    </div>
  )
}
