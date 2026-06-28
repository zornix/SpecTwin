/**
 * Shared hero scroll signal.
 *
 * `heroScroll.progress` is a plain number in [0, 1] that goes 0 → 1 as the user
 * scrolls through the (tall) hero section. It is a module-level ref-style store
 * — NOT React state — so the r3f render loop (`useFrame`) can read it every
 * frame without triggering React re-renders.
 *
 * `HeroSection` writes to it from a GSAP ScrollTrigger; the three.js scene
 * reads it inside `useFrame`. This is the seam the real animation hooks into
 * later — just read `heroScroll.progress` in your scene.
 */
export const heroScroll = {
  /** 0 at the top of the hero, 1 at the bottom. */
  progress: 0,
};
