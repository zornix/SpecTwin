import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/common/container";
import { ProductImage } from "@/components/common/product-image";
import { SpecTable } from "@/components/compare/spec-table";
import { ScoreRing } from "@/components/results/score-ring";
import { getMatches } from "@/lib/api";
import type { Sunglasses } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Compare",
};

function ProductPanel({
  item,
  tag,
  invert,
}: {
  item: Sunglasses;
  tag: string;
  invert?: boolean;
}) {
  return (
    <div className="flex flex-col border border-border bg-card">
      <div className="relative border-b border-border bg-paper-deep">
        <ProductImage item={item} />
        <span
          className={
            "label-mono absolute left-3 top-3 px-2 py-1 " +
            (invert
              ? "bg-primary text-primary-foreground"
              : "bg-foreground text-background")
          }
        >
          {tag}
        </span>
      </div>
      <div className="p-6">
        <p className="label-mono text-muted-foreground">
          {item.brand} · {item.retailer}
        </p>
        <h2 className="font-display mt-2 text-3xl font-medium leading-tight">
          {item.model}
        </h2>
        <p
          className={
            "font-display mt-4 text-4xl font-medium " +
            (invert ? "text-accent" : "")
          }
        >
          {formatPrice(item.price, item.currency)}
        </p>
      </div>
    </div>
  );
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ url?: string }>;
}) {
  const { id } = await params;
  const { url } = await searchParams;
  if (!url) notFound();

  const { source, matches } = await getMatches(url);
  const match = matches.find((m) => m.id === id);
  if (!match) notFound();

  const backHref = `/results?url=${encodeURIComponent(url)}`;

  return (
    <Container className="py-12 sm:py-16">
      <Link
        href={backHref}
        className="label-mono link-underline inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to results
      </Link>

      <div className="mt-6 flex flex-col gap-4">
        <p className="label-mono flex items-center gap-3 text-muted-foreground">
          <ScoreRing score={match.matchScore} size={34} /> spec match
        </p>
        <h1 className="font-display text-4xl font-medium leading-[1.0] tracking-[-0.01em] sm:text-6xl">
          {source.model}{" "}
          <span className="italic text-muted-foreground">vs</span> {match.model}
        </h1>
      </div>

      {/* Side by side */}
      <div className="mt-10 grid items-stretch gap-5 md:grid-cols-[1fr_auto_1fr]">
        <ProductPanel item={source} tag="Your pick" />
        <div className="flex items-center justify-center">
          <span className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
            <ArrowRight className="size-4" />
          </span>
        </div>
        <ProductPanel item={match} tag="Cheaper match" invert />
      </div>

      {/* Savings callout */}
      {match.savings > 0 ? (
        <div className="mt-5 flex flex-col items-start justify-between gap-6 border border-primary bg-primary/[0.06] p-7 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-4xl font-medium text-accent sm:text-5xl">
              Save {formatPrice(match.savings, match.currency)}
            </p>
            <p className="mt-2 text-muted-foreground">
              {match.savingsPct}% less than the {source.brand} — for a{" "}
              {match.matchScore}% spec match.
            </p>
          </div>
          <a
            href={match.productUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 shrink-0 items-center gap-2 bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            View at {match.retailer}
            <ExternalLink className="size-4" />
          </a>
        </div>
      ) : null}

      {/* Spec table */}
      <div className="mt-16">
        <h2 className="label-mono rule-t pt-5 text-muted-foreground">
          Spec by spec
        </h2>
        <p className="font-display mt-4 max-w-2xl text-2xl leading-snug sm:text-3xl">
          How the match lines up, weighted by what matters most.
        </p>
        <div className="mt-7">
          <SpecTable rows={match.comparison} />
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-6">
        <Link
          href={backHref}
          className="label-mono link-underline text-foreground transition-colors hover:text-accent"
        >
          See other matches
        </Link>
        <Link
          href="/methodology"
          className="label-mono link-underline text-muted-foreground transition-colors hover:text-foreground"
        >
          How we score matches
        </Link>
      </div>
    </Container>
  );
}
