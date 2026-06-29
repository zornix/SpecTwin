"use client";

import { useState } from "react";

import type { Sunglasses } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";

/**
 * Real product photography when the model carries an `imageUrl`, with a graceful
 * fall back to the on-brand SVG illustration (ProductImage) when there's no URL
 * or the image fails to load — so the demo never shows a broken image.
 */
export function FramePhoto({
  item,
  className,
  priority,
}: {
  item: Sunglasses;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!item.imageUrl || failed) {
    return <ProductImage item={item} className={className} priority={priority} />;
  }

  return (
    <div
      className={cn(
        "relative isolate flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-white",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl}
        alt={`${item.brand} ${item.model}, ${item.shape} frame`}
        loading={priority ? "eager" : "lazy"}
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-5 mix-blend-multiply"
      />
    </div>
  );
}
