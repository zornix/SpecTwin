"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import { useRef, type ReactNode } from "react";

import { SearchBar } from "@/components/search/search-bar";
import { heroScroll } from "./use-hero-scroll";

gsap.registerPlugin(ScrollTrigger);

// three.js is client-only; load it after hydration so it never blocks SSR.
const HeroCanvas = dynamic(
  () => import("./hero-canvas").then((m) => m.HeroCanvas),
  { ssr: false },
);

const DEFAULT_LINES: ReactNode[] = [
  "Every frame",
  <>
    has a <span className="italic text-accent">twin</span>.
  </>,
];

export function HeroSection({
  kicker = (
    <>
      <span className="text-accent">✦</span>&nbsp;&nbsp;SpecTwin — spec-matched
      eyewear
    </>
  ),
  lines = DEFAULT_LINES,
  subhead = "Paste any pair of sunglasses. SpecTwin matches it to cheaper frames on shape, size and style — scored, down to the millimetre.",
  showSearch = true,
  children,
}: {
  kicker?: ReactNode;
  lines?: ReactNode[];
  subhead?: ReactNode;
  showSearch?: boolean;
  children?: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      // Scroll progress 0→1 across the (tall) hero → drives the three.js scene.
      ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          heroScroll.progress = self.progress;
        },
      });

      if (reduce) return;

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".hero-kicker", { y: 18, opacity: 0, duration: 0.7 })
        .from(
          ".hero-line > span",
          { yPercent: 115, duration: 1, stagger: 0.12 },
          "-=0.3",
        )
        .from(".hero-sub", { y: 16, opacity: 0, duration: 0.8 }, "-=0.5")
        .from(".hero-extra", { y: 16, opacity: 0, duration: 0.8 }, "-=0.6")
        .from(".hero-cue", { opacity: 0, duration: 0.6 }, "-=0.3");

      gsap.to(content.current, {
        opacity: 0,
        y: -70,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "55% top",
          scrub: true,
        },
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative h-[180vh]">
      <div className="paper-grain sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden">
        {/* three.js stage (empty but wired) */}
        <div className="absolute inset-0 -z-20">
          <HeroCanvas />
        </div>

        {/* atmosphere */}
        <div className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(60%_50%_at_50%_42%,oklch(0.645_0.2_41/0.1),transparent_70%)]" />

        <div
          ref={content}
          className="mx-auto w-full max-w-5xl px-5 text-center sm:px-8"
        >
          <p className="hero-kicker label-mono text-muted-foreground">
            {kicker}
          </p>

          <h1 className="font-display mt-7 text-[clamp(3rem,11vw,8.5rem)] font-medium leading-[0.92] tracking-[-0.02em]">
            {lines.map((line, i) => (
              <span key={i} className="hero-line reveal-line">
                <span>{line}</span>
              </span>
            ))}
          </h1>

          {subhead ? (
            <p className="hero-sub mx-auto mt-8 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              {subhead}
            </p>
          ) : null}

          {showSearch ? (
            <div className="hero-extra mt-10" id="search">
              <SearchBar />
            </div>
          ) : children ? (
            <div className="hero-extra mt-10">{children}</div>
          ) : null}
        </div>

        <div className="hero-cue label-mono absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-3 text-muted-foreground">
          <span className="h-8 w-px bg-[var(--rule-strong)]/40" />
          Scroll
        </div>
      </div>
    </section>
  );
}
