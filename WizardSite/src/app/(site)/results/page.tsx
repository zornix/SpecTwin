import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/common/container";
import { ResultsView } from "@/components/results/results-view";
import { SourceSummary } from "@/components/results/source-summary";
import { SearchBar } from "@/components/search/search-bar";
import { getMatches } from "@/lib/api";

export const metadata: Metadata = {
  title: "Results",
};

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;

  if (!url) {
    return (
      <Container className="py-28">
        <div className="mx-auto max-w-xl text-center">
          <p className="label-mono text-accent">Nothing to compare yet</p>
          <h1 className="font-display mt-5 text-4xl font-medium sm:text-5xl">
            Paste a link to get started
          </h1>
          <p className="mt-4 text-muted-foreground">
            We need a sunglasses product URL to find cheaper matches.
          </p>
          <div className="mt-10">
            <SearchBar />
          </div>
        </div>
      </Container>
    );
  }

  const { source, matches, engine } = await getMatches(url);

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href="/#search"
            className="label-mono link-underline inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> New search
          </Link>
          <p className="label-mono mt-5 text-accent">Your reference frame</p>
        </div>
        <div className="w-full max-w-md lg:w-auto lg:min-w-[22rem]">
          <SearchBar defaultValue={url} />
        </div>
      </div>

      <div className="mt-8">
        <SourceSummary source={source} />
      </div>

      <div className="rule-t mt-16 pt-8">
        <ResultsView matches={matches} currency={source.currency} />
      </div>

      <p className="label-mono mt-12 text-center text-muted-foreground">
        Results · {engine === "fastapi" ? "FastAPI" : "Local"} engine · mock data
      </p>
    </Container>
  );
}
