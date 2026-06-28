import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Instances, Instance } from '@react-three/drei'
import { easing } from 'maath'
import type { SunglassesModel } from '../lib/model'
import { BEATS, STACK, COLORWAYS } from '../config'
import { scrollState, clamp, smooth } from '../lib/scroll'

/** Deterministic per-index value in [0,1) — stable colorways, no RNG. */
const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Weighted, deterministic colorway per pair (mostly black, a few muted tones). */
function pickColorways(count: number): THREE.Color[] {
  const total = COLORWAYS.weights.reduce((a, b) => a + b, 0)
  return Array.from({ length: count }, (_, i) => {
    let t = hash(i) * total
    let idx = 0
    for (let k = 0; k < COLORWAYS.weights.length; k++) {
      t -= COLORWAYS.weights[k]
      if (t < 0) { idx = k; break }
    }
    return new THREE.Color(COLORWAYS.colors[idx])
  })
}

/**
 * The comparable pairs stacked VERTICALLY (pair i at y = -i·spacingY), offset to
 * the left so the right half stays free for the product card. They scale in once
 * the erase hands off, and each carries a muted colorway + a gentle idle yaw.
 */
export function StackedFrames({
  model,
  count,
  pair0Ref,
}: {
  model: SunglassesModel
  count: number
  /** Receives the frame-group's pair-0 instance so the spec projector can read its
   *  live world transform. */
  pair0Ref?: { current: THREE.Object3D | null }
}) {
  const refs = useRef<(THREE.Object3D | null)[][]>(model.unbrandedGroups.map(() => []))
  const colorways = useMemo(() => pickColorways(count), [count])
  const ys = useMemo(
    () => Array.from({ length: count }, (_, i) => -i * STACK.spacingY),
    [count],
  )
  const _s = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const off = scrollState.offset
    // Pairs appear as the hero hands off (just after the erase completes).
    // ↳ tune: the 0.06 handoff window.
    const entrance = smooth(clamp((off - BEATS.erase[1]) / 0.06))
    const t = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      _s.setScalar(Math.max(entrance, 0.0001))
      // gentle idle yaw, phase-shifted per pair, for a touch of life
      const yaw = STACK.angle + Math.sin(t * 0.4 + i) * 0.05
      for (let g = 0; g < refs.current.length; g++) {
        const o = refs.current[g][i]
        if (!o) continue
        easing.damp3(o.scale, _s, 0.14, dt)
        o.rotation.y = yaw
      }
    }
  })

  return (
    <>
      {model.unbrandedGroups.map((grp, g) => (
        <Instances
          key={g}
          limit={count}
          range={count}
          geometry={grp.geometry}
          material={grp.material}
          frustumCulled={false}
        >
          {ys.map((y, i) => (
            <Instance
              key={i}
              position={[STACK.pairX, y, 0]}
              rotation={[0, STACK.angle, 0]}
              scale={0.0001}
              color={grp.kind === 'frame' ? colorways[i] : undefined}
              ref={(el: THREE.Object3D | null) => {
                refs.current[g][i] = el
                // Expose pair 0's frame instance for the spec projector.
                if (i === 0 && grp.kind === 'frame' && pair0Ref) pair0Ref.current = el
              }}
            />
          ))}
        </Instances>
      ))}
    </>
  )
}
