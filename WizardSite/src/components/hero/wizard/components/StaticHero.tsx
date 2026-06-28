'use client'

import { Suspense } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Environment, ContactShadows, Instances, Instance } from '@react-three/drei'
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing'
import { useMemo } from 'react'
import { useSunglasses } from '../lib/model'
import { COLORS, COLORWAYS, STACK, INSTANCES, TEXT, buildProducts } from '../config'
import { useIsMobile } from '../lib/useMedia'
import { ProductCard } from './ProductCard'

/**
 * prefers-reduced-motion fallback. No scroll-hijack: a static 3D pair up top, then
 * the full comparison as a normal, scrollable list of the same shadcn cards.
 */
export function StaticHero() {
  const isMobile = useIsMobile()
  const count = isMobile ? INSTANCES.mobile : INSTANCES.desktop
  const products = useMemo(() => buildProducts(count), [count])

  return (
    <main className="static-page">
      <div className="static-canvas" aria-hidden="true">
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, STACK.camZ - 0.5], fov: 35 }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 0.9
          }}
        >
          <color attach="background" args={[COLORS.paper]} />
          <Suspense fallback={null}>
            <Environment preset="studio" environmentIntensity={0.7} />
            <hemisphereLight args={['#fff7ec', '#d8d2c4', 0.35]} />
            <directionalLight position={[4, 5, 4]} intensity={1.05} color="#fff4e6" />
            <directionalLight position={[-4, 2.5, -3.5]} intensity={0.55} color="#e8eeff" />
            <StaticPair />
            <ContactShadows position={[0, -1.0, 0]} opacity={0.3} scale={8} blur={2.6} far={5} color="#2b2519" />
            <EffectComposer enableNormalPass={false} multisampling={isMobile ? 2 : 4}>
              <Bloom intensity={0.1} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur />
              <SMAA />
            </EffectComposer>
          </Suspense>
        </Canvas>
      </div>

      <div className="static-content">
        <h1 className="headline">{TEXT.headline}</h1>
        <div className="static-cards">
          {products.map((p, i) => (
            <ProductCard
              key={i}
              product={p}
              cheapest={i === count - 1}
              index={i}
              total={count}
              duration={0}
            />
          ))}
        </div>
        <a className="cta" href="/results">
          {TEXT.cta} →
        </a>
      </div>
    </main>
  )
}

/** A single static, front-facing pair for the still composition. */
function StaticPair() {
  const model = useSunglasses()
  const color = useMemo(() => new THREE.Color(COLORWAYS.colors[0]), [])
  return (
    <>
      {model.unbrandedGroups.map((grp, g) => (
        <Instances key={g} limit={1} range={1} geometry={grp.geometry} material={grp.material}>
          <Instance position={[0, 0, 0]} rotation={[0, -0.3, 0]} color={grp.kind === 'frame' ? color : undefined} />
        </Instances>
      ))}
    </>
  )
}
