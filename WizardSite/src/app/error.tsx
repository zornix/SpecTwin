"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-5 text-center">
      <p className="label-mono text-accent">Something went wrong</p>
      <h1 className="font-display mt-5 text-4xl font-medium sm:text-5xl">
        A spec didn’t add up.
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        That’s on us. Try again, or head back and start a fresh search.
      </p>
      <button
        onClick={reset}
        className="mt-9 inline-flex h-11 items-center gap-2 bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
