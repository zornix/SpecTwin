import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing'
import { easing } from 'maath'
import { useSunglasses } from '../lib/model'
import { HeroFrame } from './HeroFrame'
import { StackedFrames } from './StackedFrames'
import { SpecAnnotations } from './SpecAnnotations'
import { BEATS, INSTANCES, STACK, ERASE_CAM } from '../config'
import { scrollState, sectionFloat, smooth, clamp } from '../lib/scroll'

export function Experience({ isMobile }: { isMobile: boolean }) {
  const model = useSunglasses()
  const count = isMobile ? INSTANCES.mobile : INSTANCES.desktop

  // Pair-0's live instance Object3D — the spec projector reads its matrixWorld so the
  // callout leaders glue to the real pixels through the idle yaw + scale-in.
  const pair0Ref = useRef<THREE.Object3D | null>(null)

  // Hero + pairs all sit at STACK.pairX (left), so the hero hands off seamlessly.
  const heroOffset = useMemo(() => new THREE.Vector3(STACK.pairX, 0, 0), [])
  const heroLogoWorld = useMemo(
    () => model.logoCenter.clone().add(heroOffset),
    [model, heroOffset],
  )
  const firstSectionLook = useMemo(() => new THREE.Vector3(STACK.camLookX, 0, 0), [])

  const lookCurrent = useRef(new THREE.Vector3(STACK.camLookX, 0, 0))
  const _pos = useMemo(() => new THREE.Vector3(), [])
  const _look = useMemo(() => new THREE.Vector3(), [])

  // Intro camera path (canonical CatmullRom): hero 3/4 → logo zoom → first section.
  const introCurve = useMemo(() => {
    const heroPos = new THREE.Vector3(2.2 + STACK.pairX, 0.5, 3.4)
    const eraseZoom = heroLogoWorld.clone().add(new THREE.Vector3(...ERASE_CAM))
    const firstSection = new THREE.Vector3(STACK.camLookX, STACK.camY, STACK.camZ)
    return new THREE.CatmullRomCurve3([heroPos, eraseZoom, firstSection])
  }, [heroLogoWorld])

  useFrame((state, dt) => {
    const off = scrollState.offset
    const [s0] = STACK.sections

    if (off < s0) {
      // INTRO — sample the curve; look blends section-center → logo → back.
      introCurve.getPoint(introU(off), _pos)
      _look.lerpVectors(firstSectionLook, heroLogoWorld, lookFactor(off))

      // HERO beat: lift the gaze (and the camera a touch) so the frame drops into
      // the lower half of the screen — UNDER the hero title — then eases back to
      // normal framing as the logo zoom begins. ↳ tune the 0.7 drop.
      const heroDrop = 1 - smooth(clamp(off / BEATS.hero[1]))
      _look.y += heroDrop * 0.7
      _pos.y += heroDrop * 0.25
    } else {
      // SECTIONS — vertical dolly; one pair centered per screen, sitting left. The
      // shared sectionFloat() holds at pair 0 through the spec-analysis dwell, then
      // dollies; the price card reads the same fn so they never desync.
      const sf = sectionFloat(off, count)
      const y = -sf * STACK.spacingY
      _pos.set(STACK.camLookX, y + STACK.camY, STACK.camZ)
      _look.set(STACK.camLookX, y, 0)
    }

    // Canonical maath smoothing — snappy but eased (no overshoot).
    easing.damp3(state.camera.position, _pos, 0.2, dt)
    easing.damp3(lookCurrent.current, _look, 0.2, dt)
    state.camera.lookAt(lookCurrent.current)
  })

  return (
    <>
      {/* Product-photo lighting: studio env (glossy reflections) + key + cool rim. */}
      <Environment preset="studio" environmentIntensity={0.7} />
      <hemisphereLight args={['#fff7ec', '#d8d2c4', 0.35]} />
      <directionalLight position={[4, 5, 4]} intensity={1.05} color="#fff4e6" />
      <directionalLight position={[-4, 2.5, -3.5]} intensity={0.55} color="#e8eeff" />

      <ContactShadows
        position={[STACK.pairX, -1.05, 0]}
        opacity={0.3}
        scale={10}
        blur={2.6}
        far={5}
        resolution={isMobile ? 384 : 640}
        color="#2b2519"
      />

      <group position={heroOffset}>
        <HeroFrame model={model} />
      </group>
      <StackedFrames model={model} count={count} pair0Ref={pair0Ref} />

      {/* Spec-analysis projector: writes the first pair's anchors to the specState
          bridge each frame (mounts after the camera frame → projects current camera). */}
      <SpecAnnotations model={model} pair0Ref={pair0Ref} />

      {/* POST: MSAA + SMAA for clean edges, a whisper of Bloom. No DOF (perf). */}
      <EffectComposer enableNormalPass={false} multisampling={isMobile ? 2 : 4}>
        <Bloom intensity={isMobile ? 0.06 : 0.1} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur />
        <SMAA />
      </EffectComposer>
    </>
  )
}

/** Beat-aware intro curve parameter (hero → logo zoom → first section). */
function introU(off: number): number {
  const heroEnd = BEATS.hero[1] // 0.12
  const eraseEnd = BEATS.erase[1] // 0.30
  const s0 = STACK.sections[0] // 0.34
  if (off <= heroEnd) return smooth(off / heroEnd) * 0.5
  if (off <= eraseEnd) return 0.5 + smooth((off - heroEnd) / (eraseEnd - heroEnd)) * 0.12
  return 0.62 + smooth((off - eraseEnd) / (s0 - eraseEnd)) * 0.38
}

/** How much the camera looks at the logo (vs the first-section center). */
function lookFactor(off: number): number {
  const heroEnd = BEATS.hero[1]
  const eraseEnd = BEATS.erase[1]
  const s0 = STACK.sections[0]
  if (off <= heroEnd) return smooth(off / heroEnd)
  if (off <= eraseEnd) return 1
  return 1 - smooth((off - eraseEnd) / (s0 - eraseEnd))
}
