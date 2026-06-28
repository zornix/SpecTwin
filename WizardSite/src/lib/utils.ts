import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a price as whole-dollar currency (no cents — catalog is round). */
export function formatPrice(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Title-case a lowercase spec token (e.g. "cat-eye" → "Cat-eye"). */
export function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
