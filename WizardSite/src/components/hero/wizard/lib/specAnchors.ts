import * as THREE from 'three'
import type { SpecAnchorKey } from '../config'

/**
 * Build the spec-callout anchor points from the frame + lens GEOMETRY bounding boxes —
 * never hand-tuned positions or named-mesh detection, so they survive a model swap as
 * long as the material families exist. Points are in the model's NORMALIZED local space
 * (the same space the instances render in); the projector applies the live pair-0
 * `matrixWorld` on top.
 *
 * Axes (this frame): X = temple-to-temple width, Y = height, Z = depth — the lens plane
 * front sits at `max.z`, the temple tips trail back at `min.z`. Every anchor is derived
 * from box extents (the only literal, 0.25, is a bbox-relative fraction picking the LEFT
 * lens for a clean 3/4-pose callout — not a world coordinate).
 */
export function buildSpecAnchors(
  frameBox: THREE.Box3,
  lensBox: THREE.Box3,
): Record<SpecAnchorKey, THREE.Vector3> {
  const lc = lensBox.getCenter(new THREE.Vector3())
  const fc = frameBox.getCenter(new THREE.Vector3())
  const leftLensX = lensBox.min.x + 0.25 * (lensBox.max.x - lensBox.min.x)
  const front = lensBox.max.z // lens-plane front face

  return {
    // MATERIAL — the frame body, read at the lens-plane front center.
    frameFront: new THREE.Vector3(lc.x, lc.y, front),
    // FRAME HEIGHT — top of the frame body above the left lens (visualizes the Y extent).
    frameTop: new THREE.Vector3(leftLensX, frameBox.max.y, front),
    // LENS CATEGORY — a left-lens surface point.
    lensCenter: new THREE.Vector3(leftLensX, lc.y, front),
    // TEMPLE LENGTH — the rear-most point on one side (visualizes the Z extent / arm).
    templeTip: new THREE.Vector3(frameBox.max.x, fc.y, frameBox.min.z),
    // BRIDGE — top-center gap between the lenses.
    bridgeTop: new THREE.Vector3(lc.x, lensBox.max.y, front),
  }
}
