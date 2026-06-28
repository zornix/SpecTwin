"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import { heroScroll } from "./use-hero-scroll";

/**
 * ──────────────────────────────────────────────────────────────────────────
 * EMPTY-BUT-WIRED three.js stage.
 *
 * Everything the real animation needs is already plumbed:
 *   • a <Canvas> sized to the hero, transparent background, DPR-capped
 *   • lights
 *   • a render loop (useFrame) that reads the scroll progress every frame
 *
 * To add the real scene, drop your meshes/model inside <SceneContents> and
 * drive them from `progress` (0 at top of hero → 1 at bottom). See the marked
 * block below.
 * ──────────────────────────────────────────────────────────────────────────
 */
function SceneContents() {
  const groupRef = useRef<Group>(null);

  useFrame((_state, delta) => {
    const progress = heroScroll.progress; // 0 → 1 across the hero scroll
    const group = groupRef.current;
    if (!group) return;

    // ────────────────────────────────────────────────────────────────────
    // DROP YOUR THREE.JS SCENE HERE.
    // `progress` is the scroll-through value; `delta` is frame time (s).
    // Example the real scene might do:
    //   group.rotation.y = progress * Math.PI * 2;
    //   group.position.y = -progress * 1.5;
    // ────────────────────────────────────────────────────────────────────
    void progress;
    void delta;
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} />
      <directionalLight position={[-6, -2, -4]} intensity={0.4} color="#c8a25a" />
      {/* No geometry yet — this is the seam for the provided scene. */}
    </group>
  );
}

export function HeroCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: "none" }}
    >
      <SceneContents />
    </Canvas>
  );
}
