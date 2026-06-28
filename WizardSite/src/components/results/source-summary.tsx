import { ExternalLink } from "lucide-react";

import { ProductImage } from "@/components/common/product-image";
import type { Sunglasses } from "@/lib/types";
import { formatPrice, titleCase } from "@/lib/utils";

const SPEC_ROWS: Array<{ label: string; get: (s: Sunglasses) => string }> = [
  { label: "Shape", get: (s) => titleCase(s.shape) },
  { label: "Fit", get: (s) => titleCase(s.fit) },
  { label: "Lens", get: (s) => `${s.lensWidthMm}mm` },
  { label: "Bridge", get: (s) => `${s.bridgeMm}mm` },
  { label: "Temple", get: (s) => `${s.templeMm}mm` },
  { label: "Frame", get: (s) => titleCase(s.frameMaterial) },
  { label: "Lens mat.", get: (s) => titleCase(s.lensMaterial) },
  { label: "Polarized", get: (s) => (s.polarized ? "Yes" : "No") },
];

export function SourceSummary({ source }: { source: Sunglasses }) {
  return (
    <div className="grid border border-border bg-card md:grid-cols-[minmax(0,0.9fr)_1.3fr]">
      <div className="relative border-b border-border bg-paper-deep md:border-b-0 md:border-r">
        <ProductImage item={source} priority />
      </div>

      <div className="p-6 sm:p-9">
        <div className="flex items-center gap-3">
          <span className="label-mono bg-foreground px-2 py-1 text-background">
            Your pick
          </span>
          <span className="label-mono text-muted-foreground">
            {source.retailer}
          </span>
        </div>

        <p className="label-mono mt-6 text-muted-foreground">{source.brand}</p>
        <h1 className="font-display mt-1.5 text-4xl font-medium leading-[1.02] sm:text-5xl">
          {source.model}
        </h1>
        <p className="font-display mt-4 text-3xl font-medium text-accent">
          {formatPrice(source.price, source.currency)}
        </p>

        {source.blurb ? (
          <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted-foreground">
            {source.blurb}
          </p>
        ) : null}

        <dl className="rule-t mt-7 grid grid-cols-2 gap-px overflow-hidden border-l border-border bg-border sm:grid-cols-4">
          {SPEC_ROWS.map((row) => (
            <div key={row.label} className="bg-card px-3 py-3">
              <dt className="label-mono text-muted-foreground">{row.label}</dt>
              <dd className="font-display mt-1 text-lg">{row.get(source)}</dd>
            </div>
          ))}
        </dl>

        <a
          href={source.productUrl}
          target="_blank"
          rel="noreferrer"
          className="link-underline mt-7 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          View original listing
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
