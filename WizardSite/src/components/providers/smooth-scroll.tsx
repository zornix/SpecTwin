"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

/**
 * Canonical smooth-scroll + scroll-animation foundation.
 *
 * Lenis owns the scroll; GSAP ScrollTrigger reads from it off a single rAF loop
 * (the integration darkroom.engineering designed Lenis for). Every scroll-driven
 * animation in the app hangs off this — see `useReveal` / `useGsap` consumers.
 *
 * Respects reduced-motion: smoothing is disabled and ScrollTriggers still fire
 * (so content is never stuck hidden), just without smooth interpolation.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const lenis = new Lenis({
      lerp: reduce ? 1 : 0.1,
      duration: 1.1,
      smoothWheel: !reduce,
      wheelMultiplier: 1,
    });

    // Drive ScrollTrigger from Lenis, and Lenis from GSAP's ticker — one loop.
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Fonts shift layout (Bodoni is heavy) — re-measure triggers once loaded.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    // Smooth-scroll for in-page anchors (e.g. "Paste a link" → #search).
    const onAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest<HTMLAnchorElement>(
        'a[href^="/#"], a[href^="#"]',
      );
      if (!target) return;
      const hash = target.getAttribute("href")?.split("#")[1];
      if (!hash) return;
      const el = document.getElementById(hash);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -80 });
    };
    document.addEventListener("click", onAnchorClick);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  // App Router client navigations swap the DOM without a full reload, leaving
  // ScrollTrigger's cached measurements stale. Recompute after each route change.
  useEffect(() => {
    ScrollTrigger.refresh();
  }, [pathname]);

  return <>{children}</>;
}
