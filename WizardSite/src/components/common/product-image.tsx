import type { FrameShape, Sunglasses } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * On-brand SVG illustration of a pair of sunglasses, tinted by the product's
 * color + frame material. Used instead of remote photos so the demo never
 * shows a broken image and stays visually cohesive. `imageUrl` on the model is
 * reserved for swapping in real photography later.
 */

function lensTint(color: string): string {
  const c = color.toLowerCase();
  if (c.includes("blue")) return "#3b6fb0";
  if (c.includes("green") || c.includes("g-15")) return "#3f5e44";
  if (c.includes("red") || c.includes("revo")) return "#8a3b34";
  if (c.includes("grey") || c.includes("gray") || c.includes("smoke"))
    return "#4a4d55";
  if (c.includes("silver")) return "#566072";
  if (c.includes("gold")) return "#5b4a2a";
  return "#26262b"; // default smoke
}

function frameStroke(material: string, color: string): string {
  const c = color.toLowerCase();
  if (material === "metal" || material === "titanium") {
    if (c.includes("gold")) return "#c8a25a";
    return "#9aa0ab";
  }
  if (c.includes("tortoise") || c.includes("havana") || c.includes("caviar"))
    return "#7a5230";
  return "#15151a";
}

/** Path for one lens, centered at (0,0), half-width ~58, half-height ~46. */
function lensPath(shape: FrameShape): string | null {
  switch (shape) {
    case "wayfarer":
      return "M-58,-36 Q-58,-46 -46,-46 L46,-46 Q58,-46 58,-36 L52,34 Q50,46 36,46 L-38,46 Q-52,46 -54,34 Z";
    case "aviator":
      return "M-56,-28 Q-52,-44 -32,-44 L40,-40 Q58,-38 56,-18 L48,18 Q40,46 8,46 L-12,46 Q-44,44 -52,8 Z";
    case "cat-eye":
      return "M-58,-18 Q-54,-34 -32,-34 L46,-46 Q62,-48 58,-30 L52,28 Q48,46 26,46 L-36,44 Q-56,42 -58,18 Z";
    case "sport":
      return "M-58,-26 L42,-40 Q58,-42 58,-22 L54,22 Q50,44 24,44 L-34,42 Q-56,40 -58,14 Z";
    default:
      return null; // round / oval / square / rectangle use primitives
  }
}

function Lens({
  shape,
  cx,
  fillId,
}: {
  shape: FrameShape;
  cx: number;
  fillId: string;
}) {
  const path = lensPath(shape);
  const common = {
    fill: `url(#${fillId})`,
    stroke: "var(--frame)",
    strokeWidth: 7,
    strokeLinejoin: "round" as const,
  };
  if (path) {
    return <path d={path} transform={`translate(${cx} 120)`} {...common} />;
  }
  if (shape === "round") {
    return <circle cx={cx} cy={120} r={48} {...common} />;
  }
  if (shape === "oval") {
    return <ellipse cx={cx} cy={120} rx={56} ry={40} {...common} />;
  }
  // square / rectangle
  const w = shape === "rectangle" ? 120 : 112;
  const h = shape === "rectangle" ? 78 : 88;
  const rx = shape === "rectangle" ? 10 : 14;
  return (
    <rect
      x={cx - w / 2}
      y={120 - h / 2}
      width={w}
      height={h}
      rx={rx}
      {...common}
    />
  );
}

export function ProductImage({
  item,
  className,
  priority,
}: {
  item: Sunglasses;
  className?: string;
  priority?: boolean;
}) {
  const tint = lensTint(item.color);
  const stroke = frameStroke(item.frameMaterial, item.color);
  const uid = item.id;

  return (
    <div
      className={cn(
        "relative isolate flex aspect-[4/3] w-full items-center justify-center overflow-hidden",
        className,
      )}
      aria-hidden={!priority}
    >
      <svg
        viewBox="0 0 400 240"
        className="h-auto w-[74%] drop-shadow-[0_14px_24px_rgba(20,17,13,0.14)]"
        role="img"
        aria-label={`${item.brand} ${item.model}, ${item.shape} frame`}
        style={{ ["--frame" as string]: stroke }}
      >
        <defs>
          <linearGradient id={`lensGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tint} stopOpacity={0.55} />
            <stop offset="45%" stopColor={tint} stopOpacity={0.92} />
            <stop offset="100%" stopColor="#0c0c0e" stopOpacity={0.95} />
          </linearGradient>
        </defs>

        {/* temples */}
        <path
          d="M74 108 Q40 96 18 104"
          fill="none"
          stroke={stroke}
          strokeWidth={7}
          strokeLinecap="round"
        />
        <path
          d="M326 108 Q360 96 382 104"
          fill="none"
          stroke={stroke}
          strokeWidth={7}
          strokeLinecap="round"
        />
        {/* bridge */}
        <path
          d="M168 92 Q200 80 232 92"
          fill="none"
          stroke={stroke}
          strokeWidth={7}
          strokeLinecap="round"
        />

        <Lens shape={item.shape} cx={132} fillId={`lensGrad-${uid}`} />
        <Lens shape={item.shape} cx={268} fillId={`lensGrad-${uid}`} />

        {/* lens sheen */}
        <path
          d="M104 96 Q120 86 150 92"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
