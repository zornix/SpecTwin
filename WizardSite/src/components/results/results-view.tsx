"use client";

import { ArrowDown } from "lucide-react";
import { useMemo, useState } from "react";

import type { SunglassMatch } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import { MatchGrid } from "./match-grid";

type SortMode = "best" | "price" | "saving";

const SORT_MODES: Array<{ key: SortMode; label: string }> = [
  { key: "best", label: "Best match" },
  { key: "price", label: "Lowest price" },
  { key: "saving", label: "Top saving" },
];

/** Client wrapper for the comparable-frames grid: header + savings callout +
 *  a "Sort by" segmented control that reorders the matches in place. */
export function ResultsView({
  matches,
  currency,
}: {
  matches: SunglassMatch[];
  currency: string;
}) {
  const [sortMode, setSortMode] = useState<SortMode>("best");

  const sorted = useMemo(() => {
    const copy = [...matches];
    switch (sortMode) {
      case "price":
        return copy.sort((a, b) => a.price - b.price);
      case "saving":
        return copy.sort((a, b) => b.savings - a.savings);
      case "best":
      default:
        return copy.sort(
          (a, b) => b.matchScore - a.matchScore || b.savings - a.savings,
        );
    }
  }, [matches, sortMode]);

  const bestSavings = matches.reduce((max, m) => Math.max(max, m.savings), 0);

  return (
    <div>
      {bestSavings > 0 ? (
        <p className="inline-flex items-center gap-2 text-accent">
          <ArrowDown className="size-4" />
          <span className="font-medium">
            Top match saves you {formatPrice(bestSavings, currency)} vs. the
            original.
          </span>
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-4xl font-medium leading-[1.0] tracking-[-0.02em] sm:text-5xl">
            {matches.length} comparable{" "}
            {matches.length === 1 ? "frame" : "frames"}
          </h2>
          <p className="mt-3 text-muted-foreground">
            Ranked on the measurements that decide fit and look.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <span className="label-mono text-muted-foreground">Sort by</span>
          <div
            role="group"
            aria-label="Sort comparable frames"
            className="inline-flex items-center gap-1 rounded-full bg-secondary p-1"
          >
            {SORT_MODES.map((mode) => {
              const active = mode.key === sortMode;
              return (
                <button
                  key={mode.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSortMode(mode.key)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <MatchGrid matches={sorted} />
      </div>
    </div>
  );
}
