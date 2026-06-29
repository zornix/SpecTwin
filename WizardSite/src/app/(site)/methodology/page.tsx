import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/common/container";
import { Reveal } from "@/components/common/reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SPEC_WEIGHTS } from "@/lib/matcher";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How SpecTwin scores cheaper sunglasses matches — the specs we read, the weights we apply, and the limits of the approach.",
};

const WEIGHT_LABELS: Record<keyof typeof SPEC_WEIGHTS, string> = {
  shape: "Frame shape",
  fit: "Fit (width)",
  lensWidth: "Lens width",
  polarized: "Polarization",
  frameMaterial: "Frame material",
  lensMaterial: "Lens material",
  uv: "UV protection",
  color: "Colorway",
};

const GLOSSARY = [
  {
    term: "Frame shape",
    body: "The silhouette — wayfarer, aviator, round, square, cat-eye, sport. Visually-adjacent shapes earn partial credit.",
  },
  {
    term: "Fit",
    body: "Overall frame width bucket (narrow / medium / wide), the best single proxy for whether a frame will actually fit your face.",
  },
  {
    term: "Lens width",
    body: "The first number in a 52□18-145 spec, in millimetres. Closer is better, within an 8mm tolerance.",
  },
  {
    term: "Polarization",
    body: "Whether the lens cuts glare. A hard yes/no — it materially changes the optics.",
  },
];

const FAQS = [
  {
    q: "Is this affiliated with any of the brands shown?",
    a: "No. SpecTwin is an independent demo. Brand and product names are used for identification only.",
  },
  {
    q: "Where do prices and specs come from?",
    a: "From a catalog of ~1,500 real frames scraped from GlassesUSA — each with specs, a style profile, and product imagery. A pasted listing is resolved against that catalog and matched on the same spec profile.",
  },
  {
    q: "How is the match score calculated?",
    a: "Each spec produces a 0–1 similarity, scaled by the weights below, and combined into a 0–100 score. Cheaper candidates are then ranked by score, then by savings.",
  },
  {
    q: "Why spec-matching instead of image similarity?",
    a: "Specs are measurable and honest. Two frames can look identical in a photo yet fit and perform very differently — shape, width and lens type predict the real-world experience far better.",
  },
];

export default function MethodologyPage() {
  const maxWeight = Math.max(...Object.values(SPEC_WEIGHTS));
  const entries = Object.entries(SPEC_WEIGHTS) as Array<
    [keyof typeof SPEC_WEIGHTS, number]
  >;

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="label-mono text-accent">Methodology</p>
          <h1 className="font-display mt-5 text-balance text-5xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-6xl md:text-7xl">
            How we find a cheaper twin.
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-xl leading-relaxed text-muted-foreground">
            SpecTwin doesn’t guess from a thumbnail. It reads the measurable
            optics and fit of the pair you paste, then scores every alternative
            against that profile — leading with whatever saves you the most.
          </p>
        </Reveal>

        {/* Weights */}
        <Reveal className="mt-20">
          <h2 className="label-mono rule-t pt-5 text-muted-foreground">
            The scoring weights
          </h2>
          <p className="font-display mt-4 text-3xl font-medium leading-snug">
            Every spec counts — some more than others.
          </p>
          <ul className="mt-10 space-y-5">
            {entries.map(([key, weight]) => (
              <li key={key} className="flex items-center gap-5">
                <span className="w-36 shrink-0 text-sm">
                  {WEIGHT_LABELS[key]}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(weight / maxWeight) * 100}%` }}
                  />
                </div>
                <span className="label-mono w-10 shrink-0 text-right text-muted-foreground">
                  {Math.round(weight * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Glossary */}
        <Reveal className="mt-20">
          <h2 className="label-mono rule-t pt-5 text-muted-foreground">
            What the specs mean
          </h2>
          <dl className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2">
            {GLOSSARY.map((g) => (
              <div key={g.term} className="bg-card p-6">
                <dt className="font-display text-2xl font-medium">{g.term}</dt>
                <dd className="mt-2 leading-relaxed text-muted-foreground">
                  {g.body}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* Limitations */}
        <Reveal className="mt-20">
          <h2 className="label-mono rule-t pt-5 text-muted-foreground">
            Honest limitations
          </h2>
          <p className="font-display mt-4 text-pretty text-2xl leading-snug sm:text-3xl">
            Specs predict fit and optics — they don’t capture build quality,
            coatings or warranty.{" "}
            <span className="text-muted-foreground">
              Treat matches as a strong shortlist, not a verdict, and always
              confirm details on the retailer’s own page.
            </span>
          </p>
        </Reveal>

        {/* FAQ */}
        <Reveal className="mt-20" id="faq">
          <h2 className="label-mono rule-t pt-5 text-muted-foreground">FAQ</h2>
          <Accordion type="single" collapsible className="mt-4">
            {FAQS.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q}>
                <AccordionTrigger className="font-display py-5 text-left text-xl hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>

        <Reveal className="mt-20">
          <div className="border border-border bg-paper-deep p-10 text-center">
            <h3 className="font-display text-3xl font-medium sm:text-4xl">
              Ready to try it?
            </h3>
            <p className="mt-3 text-muted-foreground">
              Paste a pair you’re eyeing and see the cheaper field.
            </p>
            <Link
              href="/#search"
              className="mt-7 inline-flex h-12 items-center gap-2 bg-foreground px-7 text-sm font-medium text-background transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Paste a link →
            </Link>
          </div>
        </Reveal>
      </div>
    </Container>
  );
}
