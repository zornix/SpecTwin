import { ArrowUpRight } from "lucide-react";

import { ProductImage } from "@/components/common/product-image";
import type { SunglassMatch } from "@/lib/types";
import { cn, formatPrice, titleCase } from "@/lib/utils";
import { ScoreRing } from "./score-ring";

export function MatchCard({
  match,
  className,
}: {
  match: SunglassMatch;
  className?: string;
}) {
  return (
    <a
      href={match.productUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`View ${match.brand} ${match.model} at ${match.retailer}`}
      className={cn(
        "group relative flex flex-col border border-border bg-card transition-colors duration-300 hover:border-[var(--rule-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <div className="rule-b relative overflow-hidden bg-paper-deep">
        <div className="transition-transform duration-500 ease-out group-hover:scale-[1.04]">
          <ProductImage item={match} />
        </div>
        {match.savingsPct > 0 ? (
          <span className="label-mono absolute left-3 top-3 bg-primary px-2 py-1 text-primary-foreground">
            −{match.savingsPct}%
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-mono text-muted-foreground">{match.brand}</p>
            <h3 className="font-display mt-1.5 truncate text-2xl font-medium leading-tight">
              {match.model}
            </h3>
          </div>
          <ScoreRing score={match.matchScore} />
        </div>

        <p className="label-mono mt-4 text-muted-foreground">
          {titleCase(match.shape)} · {titleCase(match.frameMaterial)}
          {match.polarized ? " · Polarized" : ""}
        </p>

        <div className="rule-t mt-5 flex items-end justify-between pt-4">
          <div>
            <p className="font-display text-3xl font-medium leading-none">
              {formatPrice(match.price, match.currency)}
            </p>
            {match.savings > 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                <span className="line-through">
                  {formatPrice(match.price + match.savings, match.currency)}
                </span>{" "}
                <span className="text-accent">
                  save {formatPrice(match.savings, match.currency)}
                </span>
              </p>
            ) : null}
          </div>
          <span className="flex size-9 items-center justify-center bg-foreground text-background transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </a>
  );
}
