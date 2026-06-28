import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { SunglassesModel } from '../lib/model'
import { buildSpecAnchors } from '../lib/specAnchors'
import { SPECS, BEATS } from '../config'
import { scrollState, specState, dwellProgress, smooth, clamp } from '../lib/scroll'

/**
 * In-canvas spec projector (renders nothing). Each frame it takes the FIRST pair's
 * live world transform (`pair0Ref.matrixWorld` — folds in pairX, the idle yaw, and the
 * scale-in), maps every geometry-derived anchor to SCREEN pixels via the current
 * camera, and writes the result + a reveal gate into the `specState` bridge. The DOM
 * `SpecOverlay` reads that bridge and draws the leader lines + labels. Mounting this as
 * a child of Experience registers its useFrame AFTER the camera update, so it always
 * projects with the camera's current position.
 */
export function SpecAnnotations({
  model,
  pair0Ref,
}: {
  model: SunglassesModel
  pair0Ref: { current: THREE.Object3D | null }
}) {
  const size = useThree((s) => s.size)

  // Local anchor points, derived once from the frame + lens geometry bounding boxes,
  // ordered to match SPECS so specState.points[k] ↔ SPECS[k].
  const localAnchors = useMemo(() => {
    const grpGeo = (kind: string) =>
      model.unbrandedGroups.find((g) => g.kind === kind)?.geometry
    const frameGeo = grpGeo('frame') ?? model.unbrandedGroups[0].geometry
    const lensGeo = grpGeo('lens') ?? frameGeo
    frameGeo.computeBoundingBox()
    lensGeo.computeBoundingBox()
    const anchors = buildSpecAnchors(frameGeo.boundingBox!, lensGeo.boundingBox!)
    return SPECS.map((s) => anchors[s.key])
  }, [model])

  const _v = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const off = scrollState.offset

    // Reveal gate: ramp in only once the frame has settled (mirror StackedFrames'
    // entrance), scaled by progress through the dwell.
    const entrance = smooth(clamp((off - BEATS.erase[1]) / 0.06))
    const gate = smooth(clamp((entrance - 0.85) / 0.15))
    specState.reveal = gate * dwellProgress(off)

    const obj = pair0Ref.current
    if (!obj || specState.reveal <= 0.0001) {
      for (const p of specState.points) p.on = false
      return
    }

    obj.updateWorldMatrix(true, false)
    for (let k = 0; k < localAnchors.length; k++) {
      _v.copy(localAnchors[k]).applyMatrix4(obj.matrixWorld).project(state.camera)
      const p = specState.points[k]
      p.on = _v.z < 1 // in front of the camera
      p.x = (_v.x * 0.5 + 0.5) * size.width
      p.y = (1 - (_v.y * 0.5 + 0.5)) * size.height
    }
  })

  return null
}
