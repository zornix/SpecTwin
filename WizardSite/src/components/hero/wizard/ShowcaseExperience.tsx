'use client'

import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import dynamic from 'next/dynamic'
import { useRef } from 'react'

import { heroScroll } from '../use-hero-scroll'
import { NarrativeOverlay } from './components/NarrativeOverlay'
import { ProductPanel } from './components/ProductPanel'
import { SpecOverlay } from './components/SpecOverlay'
import { StaticHero } from './components/StaticHero'
import { SCROLL_PAGES, TEXT } from './config'
import { usePrefersReducedMotion } from './lib/useMedia'
import './wizard.css'

gsap.registerPlugin(ScrollTrigger)

// three.js is client-only and heavy — load it after hydration.
const ShowcaseCanvas = dynamic(
  () => import('./ShowcaseCanvas').then((m) => m.ShowcaseCanvas),
  { ssr: false },
)

/**
 * The full Spectwin scroll hero. A tall driver section maps our GSAP/Lenis scroll
 * to heroScroll.progress (the same signal the rest of the site uses); the fixed-
 * in-place sticky stage holds the three.js Canvas + the DOM overlays, all reading
 * that progress. Reduced motion renders the static, non-hijacking fallback.
 */
export function ShowcaseExperience() {
  const reduced = usePrefersReducedMotion()
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      if (reduced || !root.current) return
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          heroScroll.progress = self.progress
        },
      })
    },
    { scope: root, dependencies: [reduced] },
  )

  if (reduced) return <StaticHero />

  return (
    <section
      ref={root}
      className="wizard-exp relative"
      style={{ height: `${SCROLL_PAGES * 100}vh` }}
    >
      {/* Accessible summary — the canvas + overlays are decorative (aria-hidden). */}
      <header className="sr-only">
        <h1>{TEXT.headline}</h1>
        <p>{TEXT.headlineSub}</p>
        <a href="/results">{TEXT.cta}</a>
      </header>

      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <ShowcaseCanvas />
        </div>
        <NarrativeOverlay />
        <SpecOverlay />
        <ProductPanel />
      </div>
    </section>
  )
}
