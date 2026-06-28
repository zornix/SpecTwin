import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/nav/wordmark";

export const metadata: Metadata = {
  title: "SpecTwin — Showcase",
  description:
    "SpecTwin reads a pair of sunglasses down to the millimetre and finds its cheaper twin. A showcase demo.",
};

/** Minimal standalone chrome for the Spectwin showcase — just the brand mark,
 *  no nav or footer. Sits outside the (site) group so the main Spectra chrome
 *  never appears here. */
export default function ShowcaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-[68px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="SpecTwin">
            <Wordmark name="SpecTwin" />
          </Link>
          <span className="label-mono text-muted-foreground">Showcase demo</span>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
