import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { isLogoMaterial, isFrameMaterial, isLensMaterial, isMetalMaterial } from '../config'

const URL = '/Sunglasses.glb'

// Preload at module load so the GLB is fetched/decoded before first paint.
// drei wires up Draco + meshopt decoders automatically when the GLB needs them.
useGLTF.preload(URL)

export type GroupKind = 'frame' | 'lens' | 'metal' | 'other'

export type UnbrandedGroup = {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  kind: GroupKind // so the row can tint only the frame body
}

export type SunglassesModel = {
  scene: THREE.Group
  /** Normalization so hero and instances share one size/pivot: world → s*(world - center). */
  center: THREE.Vector3
  scale: number
  /** A representative temple logo's center in NORMALIZED space — the erase zoom target. */
  logoCenter: THREE.Vector3
  /** Merged geometry per material, logo EXCLUDED — used for the instanced copies. */
  unbrandedGroups: UnbrandedGroup[]
}

/**
 * Loads Sunglasses.glb, logs every mesh/material name once, tunes materials, and
 * prepares (a) a normalization transform, (b) the logo's normalized center for the
 * erase zoom, and (c) merged unbranded geometry groups for instancing (logo
 * excluded; frame body given a neutral, tintable material clone).
 */
export function useSunglasses(): SunglassesModel {
  const { scene } = useGLTF(URL)

  return useMemo(() => {
    scene.updateWorldMatrix(true, true)

    // ── Material tuning: keep speculars from blowing out under the studio env. ──
    tuneMaterials(scene)

    // ── Normalization: fit the frame into ~1.6 units, pivot at its center. ──
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = 1.6 / Math.max(size.x, size.y, size.z)
    const toNormalized = (p: THREE.Vector3) => p.clone().sub(center).multiplyScalar(scale)

    // ── Logo zoom target: pick the temple logo furthest to one side for a clean 3/4. ──
    const logoCenter = new THREE.Vector3()
    {
      let best: THREE.Mesh | null = null
      let bestX = -Infinity
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!(mesh as THREE.Mesh).isMesh) return
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        if (!isLogoMaterial(mat?.name)) return
        const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())
        if (Math.abs(c.x) > bestX) {
          bestX = Math.abs(c.x)
          best = mesh
        }
      })
      const worldLogo = best
        ? new THREE.Box3().setFromObject(best).getCenter(new THREE.Vector3())
        : center.clone()
      logoCenter.copy(toNormalized(worldLogo))
    }

    // ── Build merged geometry per material family, excluding the logo. ──
    // Each copy is the unbranded frame, so the logo never enters the row.
    const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>()
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!(mesh as THREE.Mesh).isMesh) return
      const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material
      if (!mat || isLogoMaterial(mat.name)) return

      const g = sanitizeGeometry(mesh.geometry)
      g.applyMatrix4(mesh.matrixWorld)
      g.translate(-center.x, -center.y, -center.z)
      g.scale(scale, scale, scale)
      const list = byMaterial.get(mat) ?? []
      list.push(g)
      byMaterial.set(mat, list)
    })

    const unbrandedGroups: UnbrandedGroup[] = [...byMaterial.entries()]
      .map(([material, geos]) => {
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
        if (!merged) return null

        const kind: GroupKind = isFrameMaterial(material.name)
          ? 'frame'
          : isLensMaterial(material.name)
            ? 'lens'
            : isMetalMaterial(material.name)
              ? 'metal'
              : 'other'

        // The frame body uses a NEUTRAL clone so per-instance instanceColor (the
        // colorways) reads. The hero keeps the original dark material untouched.
        let instMaterial = material
        if (kind === 'frame') {
          const clone = (material as THREE.MeshStandardMaterial).clone()
          clone.color = new THREE.Color('#ffffff')
          instMaterial = clone
        }

        return { material: instMaterial, geometry: merged, kind }
      })
      .filter((g): g is UnbrandedGroup => g !== null)

    return { scene, center, scale, logoCenter, unbrandedGroups }
  }, [scene])
}

const tuned = new Set<THREE.Material>()
let glassMaterial: THREE.MeshPhysicalMaterial | null = null
let frameMaterial: THREE.MeshPhysicalMaterial | null = null

/**
 * Canonical glossy acetate: a clear-coated MeshPhysicalMaterial so the black
 * frame catches the studio softbox as a crisp lacquered highlight (real Prada
 * acetate is high-gloss). Base color stays deep black for the hero; the instanced
 * copies clone this and override the base color for the muted colorways.
 */
function getFrameMaterial(srcName: string): THREE.MeshPhysicalMaterial {
  if (!frameMaterial) {
    frameMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#0b0b0c'),
      metalness: 0,
      roughness: 0.26, // glossy, not matte
      clearcoat: 0.85, // lacquered coat → the premium sheen
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.1, // reflect the studio env
    })
  }
  frameMaterial.name = srcName // keep the `black*` prefix so group kind === 'frame'
  return frameMaterial
}

/**
 * Canonical glassy lens: a clear-coated MeshPhysicalMaterial that picks up the
 * studio Environment as a real specular reflection. Low roughness + clearcoat
 * gives the "glassy" sheen; transparency lets you see through. We use a thin
 * transparent lens (not `transmission`) because transmission doesn't instance —
 * the row needs 48 of these. One shared instance keeps draw state minimal.
 */
function getGlassMaterial(srcName: string): THREE.MeshPhysicalMaterial {
  if (!glassMaterial) {
    glassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#aeb8c0'), // faint cool tint
      metalness: 0,
      roughness: 0.05, // sharp environment reflections
      transparent: true,
      opacity: 0.4,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.3, // strength of the reflected studio env
      depthWrite: false, // avoids transparent-instance sorting artifacts
      side: THREE.FrontSide,
    })
  }
  glassMaterial.name = srcName // keep the `glass*` prefix so group kind === 'lens'
  return glassMaterial
}

/**
 * Tune the source materials (matched by family prefix so they survive name drift):
 *  - lenses → REPLACED with a glassy reflective MeshPhysicalMaterial
 *  - steel  → brushed metal that still catches the environment
 *  - acetate→ dark, slightly glossy
 * Runs on the scene meshes (so the swap is visible to both the hero clone and the
 * instanced groups built afterward). Materials are shared, so it's effectively once.
 */
function tuneMaterials(scene: THREE.Group) {
  const apply = (m: THREE.Material | null | undefined): THREE.Material | null => {
    if (!m) return m ?? null
    if (isLensMaterial(m.name)) return getGlassMaterial(m.name) // swap in real glass
    if (isFrameMaterial(m.name)) return getFrameMaterial(m.name) // swap in glossy acetate
    if (tuned.has(m)) return m
    tuned.add(m)
    const std = m as THREE.MeshStandardMaterial
    if (isMetalMaterial(m.name)) {
      std.roughness = 0.32
      std.metalness = 1
      std.envMapIntensity = 1.0 // reflect the studio env (shiny hinges/bolts)
    } else {
      std.envMapIntensity = Math.min(std.envMapIntensity ?? 1, 0.9)
    }
    std.needsUpdate = true
    return m
  }

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!(mesh as THREE.Mesh).isMesh) return
    mesh.material = Array.isArray(mesh.material)
      ? (mesh.material.map(apply) as THREE.Material[])
      : (apply(mesh.material) as THREE.Material)
  })
}

/**
 * Normalize a geometry so disparate meshes merge + instance reliably: drop to
 * non-indexed position/normal/uv (defaulting UVs and recomputing normals when a
 * source mesh is missing them). Without this, mergeGeometries() can return null
 * on attribute mismatches.
 */
function sanitizeGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone()
  if (!g.getAttribute('normal')) g.computeVertexNormals()
  if (!g.getAttribute('uv')) {
    const n = g.getAttribute('position').count
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', g.getAttribute('position'))
  out.setAttribute('normal', g.getAttribute('normal'))
  out.setAttribute('uv', g.getAttribute('uv'))
  return out
}
