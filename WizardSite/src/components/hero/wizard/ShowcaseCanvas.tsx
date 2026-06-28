'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'

import { heroScroll } from '../use-hero-scroll'
import { Experience } from './components/Experience'
import { COLORS } from './config'
import { scrollState } from './lib/scroll'
import { useIsMobile } from './lib/useMedia'

/**
 * In-canvas driver — copies our GSAP/Lenis hero progress (heroScroll.progress,
 * written by ShowcaseExperience's ScrollTrigger) into the Wizard scroll bridge
 * (scrollState.offset) each frame. This is the single seam that replaces drei's
 * ScrollControls: everything downstream still reads scrollState.offset.
 */
function ScrollDriver() {
  useFrame(() => {
    scrollState.offset = heroScroll.progress
  })
  return null
}

export function ShowcaseCanvas() {
  const isMobile = useIsMobile()

  return (
    <Canvas
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [2.4, 0.6, 3.6], fov: 35, near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 0.9
      }}
    >
      <color attach="background" args={[COLORS.paper]} />
      <fog attach="fog" args={[COLORS.paper, 14, 30]} />
      <ScrollDriver />
      <Suspense fallback={null}>
        <Experience isMobile={isMobile} />
      </Suspense>
    </Canvas>
  )
}
