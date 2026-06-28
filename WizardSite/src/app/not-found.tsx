import Link from "next/link";

import { Container } from "@/components/common/container";

export default function NotFound() {
  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <span className="font-display text-[7rem] font-medium leading-none text-accent sm:text-[10rem]">
        404
      </span>
      <h1 className="font-display mt-4 text-3xl font-medium">
        We couldn’t find that page
      </h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        The link may be broken, or the comparison expired. Start a fresh search.
      </p>
      <div className="mt-9 flex items-center gap-6">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Back home →
        </Link>
        <Link
          href="/#search"
          className="label-mono link-underline text-muted-foreground transition-colors hover:text-foreground"
        >
          New search
        </Link>
      </div>
    </Container>
  );
}
