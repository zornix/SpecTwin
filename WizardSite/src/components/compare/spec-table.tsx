import { Check, Minus } from "lucide-react";

import type { SpecComparison } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";

export function SpecTable({ rows }: { rows: SpecComparison[] }) {
  return (
    <div className="border border-border bg-card">
      <div className="label-mono grid grid-cols-[1.4fr_1fr_1fr_auto] gap-2 border-b border-border px-4 py-3 text-muted-foreground sm:px-6">
        <span>Spec</span>
        <span>Yours</span>
        <span>Match</span>
        <span className="text-right">Aligned</span>
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.label}
            className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:px-6"
          >
            <span className="font-medium">{row.label}</span>
            <span className="text-muted-foreground">{titleCase(row.source)}</span>
            <span
              className={cn(
                "font-medium",
                row.aligned ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {titleCase(row.match)}
            </span>
            <span className="flex justify-end">
              {row.aligned ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" />
                </span>
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full border border-border text-muted-foreground">
                  <Minus className="size-3.5" />
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
