import Link from "next/link";

import { Container } from "@/components/common/container";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#search", label: "Paste a link" },
      { href: "/methodology", label: "Methodology" },
    ],
  },
  {
    title: "More",
    links: [
      { href: "/methodology", label: "How we match" },
      { href: "https://github.com", label: "GitHub" },
      { href: "/methodology#faq", label: "FAQ" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="rule-t mt-12 bg-paper-deep">
      <Container className="pb-12 pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <p className="label-mono text-muted-foreground">SpecTwin — est. 2026</p>
            <p className="font-display mt-5 max-w-md text-pretty text-2xl leading-snug sm:text-3xl">
              The spec is the product.{" "}
              <span className="italic text-accent">The logo is the markup.</span>
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="label-mono text-muted-foreground">{col.title}</h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="link-underline text-lg text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Oversized wordmark */}
        <div className="rule-t mt-16 pt-10">
          <p className="font-display select-none text-[18vw] font-medium leading-[0.8] tracking-[-0.02em] text-ink/90 lg:text-[15rem]">
            SpecTwin
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 SpecTwin. A demo project — not affiliated with any brand shown.</p>
          <p className="max-w-md text-pretty">
            Prices and specs come from public catalog listings and may be out of
            date. Confirm details on the retailer&apos;s site before buying.
          </p>
        </div>
      </Container>
    </footer>
  );
}
