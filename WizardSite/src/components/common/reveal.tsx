"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger);

/**
 * Canonical GSAP/ScrollTrigger reveal. Fades + lifts content as it enters the
 * viewport. No-JS renders content normally (gsap.from only hides after mount);
 * reduced-motion skips the animation entirely.
 */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  id,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce || !ref.current) return;

      gsap.from(ref.current, {
        opacity: 0,
        y,
        duration: 1,
        delay,
        ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 88%" },
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  );
}
