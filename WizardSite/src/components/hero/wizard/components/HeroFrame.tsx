import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import { easing } from 'maath'
import type { SunglassesModel } from '../lib/model'
import { BEATS, COLORS, isLogoMaterial } from '../config'
import { scrollState, beatProgress, smooth, pulse, clamp } from '../lib/scroll'

/**
 * The single branded hero frame. Owns the logo-erase dissolve shader (HERO ONLY —
 * the instanced copies in InstancedFrames never touch this material). Idle motion
 * uses drei <Float>; it hands off to the row by damping its scale to 0 once the
 * logo has fully erased.
 */
export function HeroFrame({ model }: { model: SunglassesModel }) {
  const outer = useRef<THREE.Group>(null!) // handoff scale
  const handoff = useRef(1)

  // Uniforms driving the dissolve. Kept on a ref so we can mutate per-frame after
  // the shader compiles (onBeforeCompile copies these into shader.uniforms).
  const uniforms = useRef({
    uErase: { value: 0 }, // 0 = logo intact, 1 = fully dissolved
    uFlash: { value: 0 }, // transient emissive flash during the erase
    uNoiseScale: { value: 58 }, // grain size of the dissolve threshold
    uEdge: { value: 0.14 }, // width of the glowing dissolve edge
    uAccent: { value: new THREE.Color(COLORS.accent) },
  })

  // Clone the scene so the hero has its own object graph, then swap each logo
  // material (the brand spans several slots) for a dissolve-driven clone sharing
  // our uniforms. Non-logo materials are shared (read-only).
  const heroScene = useMemo(() => {
    const root = model.scene.clone(true)
    const dissolveFor = new Map<THREE.Material, THREE.Material>() // original → dissolve clone

    const resolve = (m: THREE.Material | null | undefined): THREE.Material | null => {
      if (!m) return m ?? null
      if (!isLogoMaterial(m.name)) return m
      let d = dissolveFor.get(m)
      if (!d) {
        d = makeDissolveMaterial(m, uniforms.current)
        dissolveFor.set(m, d)
      }
      return d
    }

    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!(mesh as THREE.Mesh).isMesh) return
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => resolve(m) as THREE.Material)
        : (resolve(mesh.material) as THREE.Material)
    })
    return root
  }, [model])

  useFrame((_, dt) => {
    const off = scrollState.offset
    const eraseP = beatProgress(off, BEATS.erase)

    // ERASE: drive the dissolve + a short emissive flash at mid-erase. uErase
    // reaches 1 at the end of the erase beat (~0.30), so the logo is visibly gone
    // before the vertical scroll begins. ↳ tune: uEdge + the 0.6 flash gain.
    uniforms.current.uErase.value = smooth(eraseP)
    uniforms.current.uFlash.value = pulse(off, BEATS.erase) * 0.6

    // HANDOFF: just after the erase, shrink the hero to 0 as the vertical stack's
    // first pair takes its place. ↳ tune: the 0.30→0.34 window + damp.
    const target = 1 - smooth(clamp((off - BEATS.erase[1]) / 0.04))
    easing.damp(handoff, 'current', target, 0.16, dt)

    if (outer.current) {
      outer.current.scale.setScalar(Math.max(handoff.current, 0.0001))
      outer.current.visible = handoff.current > 0.004
    }
  })

  // Normalization group: world → s*(world - center), matching the instances.
  const nPos = useMemo(
    () => model.center.clone().multiplyScalar(-model.scale),
    [model],
  )

  return (
    <group ref={outer}>
      {/* BEAT 1 — HERO idle: canonical drei <Float> (gentle, no overshoot). */}
      <Float speed={1.2} rotationIntensity={0.35} floatIntensity={0.6} floatingRange={[-0.015, 0.02]}>
        <group rotation={[0, -0.5, 0]}>
          <group position={nPos} scale={model.scale}>
            <primitive object={heroScene} />
          </group>
        </group>
      </Float>
    </group>
  )
}

/**
 * Clone a logo material and inject a noise-threshold dissolve via onBeforeCompile.
 * The frame body material is left completely untouched underneath.
 */
function makeDissolveMaterial(
  original: THREE.Material,
  u: Record<string, { value: unknown }>,
): THREE.Material {
  const mat = original.clone()
  mat.transparent = true

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDissolvePos;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvDissolvePos = transformed;',
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vDissolvePos;
        uniform float uErase;
        uniform float uFlash;
        uniform float uNoiseScale;
        uniform float uEdge;
        uniform vec3 uAccent;
        float hash13(vec3 p){
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }`,
      )
      .replace(
        '#include <dithering_fragment>',
        /* glsl */ `
        float _n = hash13(vDissolvePos * uNoiseScale);
        if (_n < uErase) discard;                       // erase away below threshold
        float _edge = smoothstep(uErase, uErase + uEdge, _n);
        float _band = (1.0 - _edge) * step(0.0008, uErase);
        gl_FragColor.rgb += uAccent * (_band * 1.7 + uFlash * 0.8);
        #include <dithering_fragment>`,
      )
  }
  mat.needsUpdate = true
  return mat
}
