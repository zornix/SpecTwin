"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";

const UrlSchema = z.string().trim().url();

const EXAMPLES = [
  {
    label: "Ray-Ban Wayfarer",
    url: "https://www.ray-ban.com/usa/sunglasses/RB2140",
  },
  {
    label: "Oakley Holbrook",
    url: "https://www.oakley.com/en-us/product/W0OO9102",
  },
  { label: "Persol 649", url: "https://www.persol.com/usa/0PO0649" },
];

export function SearchBar({
  defaultValue = "",
  className,
  onSubmitUrl,
}: {
  defaultValue?: string;
  className?: string;
  /** If provided, called with a valid URL instead of navigating to /results.
   *  Used by the standalone Spectwin showcase to stay self-contained. */
  onSubmitUrl?: (url: string) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  function submit(raw: string) {
    const parsed = UrlSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error("That doesn’t look like a valid link", {
        description: "Paste a full product URL, e.g. https://…",
      });
      return;
    }
    if (onSubmitUrl) {
      onSubmitUrl(parsed.data);
      return;
    }
    startTransition(() => {
      router.push(`/results?url=${encodeURIComponent(parsed.data)}`);
    });
  }

  return (
    <div className={cn("mx-auto w-full max-w-xl", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="group flex items-center gap-3 border border-[var(--rule-strong)]/30 bg-card/80 py-2 pl-5 pr-2 backdrop-blur transition-colors focus-within:border-[var(--rule-strong)]"
      >
        <span className="label-mono shrink-0 text-muted-foreground">URL</span>
        <input
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a sunglasses link…"
          aria-label="Sunglasses product URL"
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Find cheaper pairs"
          className="group/btn inline-flex h-11 shrink-0 items-center gap-2 bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <span className="hidden sm:inline">Find pairs</span>
              <span className="sm:hidden">Find</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <span className="label-mono text-muted-foreground">Try</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.url}
            type="button"
            onClick={() => {
              setValue(ex.url);
              submit(ex.url);
            }}
            className="link-underline text-sm text-foreground/70 transition-colors hover:text-foreground"
          >
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}
