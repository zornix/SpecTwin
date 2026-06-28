import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { Container } from "./container";

interface SectionProps extends ComponentProps<"section"> {
  bleed?: boolean;
}

/** Vertical rhythm wrapper for page sections. */
export function Section({
  className,
  children,
  bleed = false,
  ...props
}: SectionProps) {
  return (
    <section className={cn("py-24 sm:py-32", className)} {...props}>
      {bleed ? children : <Container>{children}</Container>}
    </section>
  );
}

/**
 * Editorial section heading: a mono index + eyebrow on a hairline rule, then a
 * large Bodoni display title and an optional lede. Fashion-magazine cadence.
 */
export function SectionHeading({
  index,
  eyebrow,
  title,
  lede,
  className,
}: {
  index?: string;
  eyebrow?: string;
  title: string;
  lede?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {(index || eyebrow) && (
        <div className="rule-t flex items-center gap-4 pt-4">
          {index ? (
            <span className="label-mono text-accent">{index}</span>
          ) : null}
          {eyebrow ? (
            <span className="label-mono text-muted-foreground">{eyebrow}</span>
          ) : null}
        </div>
      )}
      <h2 className="font-display mt-6 text-balance text-4xl font-medium leading-[1.04] tracking-[-0.01em] sm:text-5xl md:text-6xl">
        {title}
      </h2>
      {lede ? (
        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          {lede}
        </p>
      ) : null}
    </div>
  );
}
