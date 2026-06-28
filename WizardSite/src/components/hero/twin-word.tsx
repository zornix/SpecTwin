"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { heroScroll } from "./use-hero-scroll";

/**
 * Renders a word with a subtly offset "twin" — a ghost duplicate that drifts
 * apart from the original as you scroll the hero (parallax), then settles.
 * A small visual pun for Spectwin. Reduced-motion gets a static double.
 */
export function TwinWord({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ghost = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const el = ghost.current;
    if (reduce || !el) return;

    let raf = 0;
    const tick = () => {
      // heroScroll.progress: 0 at top of hero → 1 at bottom.
      const p = heroScroll.progress;
      const x = 0.05 + p * 0.22; // separate horizontally on scroll
      const y = 0.04 + p * 0.05; // tiny vertical drift (stays within the line)
      el.style.transform = `translate(${x}em, ${y}em)`;
      el.style.opacity = `${0.32 - p * 0.14}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span className={cn("relative inline-block", className)}>
      <span
        ref={ghost}
        aria-hidden
        className="pointer-events-none absolute inset-0 italic text-accent"
        style={{ transform: "translate(0.05em, 0.04em)", opacity: 0.32 }}
      >
        {children}
      </span>
      <span className="relative italic text-accent">{children}</span>
    </span>
  );
}
