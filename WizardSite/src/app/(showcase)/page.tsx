import { Container } from "@/components/common/container";
import { Reveal } from "@/components/common/reveal";
import { ShowcaseExperience } from "@/components/hero/wizard/ShowcaseExperience";
import { ShowcaseInput } from "./showcase-input";

type Partner = { name: string; href: string; role: string; logo: string };

const BUILT_WITH: Partner[] = [
  {
    name: "You.com",
    href: "https://you.com",
    role: "Contents API — catalog harvesting past anti-bot walls",
    logo: "/logos/you.png",
  },
  {
    name: "Nebius",
    href: "https://nebius.com",
    role: "AI inference — CLIP embeddings + LLM style matching",
    logo: "/logos/nebius.png",
  },
  {
    name: "Claude Code",
    href: "https://claude.com/claude-code",
    role: "Agentic coding — scaffolded and built this site",
    logo: "/logos/claude.png",
  },
  {
    name: "Blender",
    href: "https://www.blender.org",
    role: "3D — modelled the hero frame",
    logo: "/logos/blender.png",
  },
  {
    name: "Figma",
    href: "https://www.figma.com",
    role: "Design — UI and layout exploration",
    logo: "/logos/figma.png",
  },
];

// Repeat enough to fill the strip, then duplicate the track for a seamless −50% loop.
const MARQUEE_FILL = Array.from({ length: 3 }, () => BUILT_WITH).flat();
const MARQUEE_TRACK = [...MARQUEE_FILL, ...MARQUEE_FILL];

/**
 * SpecTwin — the standalone showcase. The scrollable three.js narrative (logo
 * dissolve → spec-matched comparable pairs → rolling price/discount/match-score
 * card) runs first, then resolves into the real, brand-styled input field.
 */
export default function ShowcasePage() {
  return (
    <>
      <ShowcaseExperience />

      {/* The experience resolves into the real input — paste a link, get ranked twins. */}
      <section
        id="search"
        className="scroll-mt-[68px] border-t border-border bg-paper-deep py-24 sm:py-32"
      >
        <Container className="text-center">
          <Reveal>
            <p className="label-mono text-accent">Try it live</p>
            <h2 className="font-display mx-auto mt-6 max-w-2xl text-balance text-4xl font-medium leading-[1.0] tracking-[-0.02em] sm:text-6xl">
              Paste a link to a pair of sunglasses.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-muted-foreground">
              SpecTwin ranks the cheaper twins by match score and savings — pasted
              frame to results in one step.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-12">
            <ShowcaseInput />
          </Reveal>
        </Container>
      </section>

      {/* Built with — canonical scrolling partner logo strip. */}
      <section className="border-t border-border py-16 sm:py-20">
        <Reveal>
          <Container>
            <p className="label-mono text-center text-muted-foreground">
              Built with
            </p>
          </Container>

          <div className="group relative mt-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="flex w-max animate-marquee items-center gap-20 pr-20 group-hover:[animation-play-state:paused] sm:gap-28 sm:pr-28">
              {MARQUEE_TRACK.map((tool, i) => (
                <a
                  key={`${tool.name}-${i}`}
                  href={tool.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-hidden={i >= MARQUEE_FILL.length}
                  aria-label={`${tool.name} — ${tool.role}`}
                  title={`${tool.name} — ${tool.role}`}
                  className="group/logo flex shrink-0 items-center rounded-sm opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:grayscale-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tool.logo}
                    alt={tool.name}
                    loading="lazy"
                    className="h-9 w-auto object-contain sm:h-11"
                  />
                </a>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
