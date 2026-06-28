import type { SunglassMatch } from "@/lib/types";
import { MatchCard } from "./match-card";

export function MatchGrid({ matches }: { matches: SunglassMatch[] }) {
  if (matches.length === 0) {
    return (
      <div className="border border-dashed border-[var(--rule-strong)]/30 bg-card p-12 text-center">
        <p className="font-display text-2xl">No cheaper matches found</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          This pair is already competitively priced for its specs. Try a
          different link.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}
