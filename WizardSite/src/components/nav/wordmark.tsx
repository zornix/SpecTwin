import { cn } from "@/lib/utils";

/** Brand wordmark: a minimal twin-lens mark (ink + orange bridge) + Bodoni name. */
export function Wordmark({
  className,
  name = "SpecTwin",
}: {
  className?: string;
  name?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 40 24"
        className="h-[18px] w-[30px]"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 7 Q2 5 9 5 L16 5 Q18 5 18 8 L17 14 Q16.5 17 12 17 Q5 17 4 12 Z"
          stroke="var(--ink)"
          strokeWidth="1.6"
        />
        <path
          d="M38 7 Q38 5 31 5 L24 5 Q22 5 22 8 L23 14 Q23.5 17 28 17 Q35 17 36 12 Z"
          stroke="var(--ink)"
          strokeWidth="1.6"
        />
        <path d="M18 7 Q20 6 22 7" stroke="var(--orange)" strokeWidth="2" />
      </svg>
      <span className="font-display text-xl font-medium tracking-[-0.01em]">
        {name}
      </span>
    </span>
  );
}
