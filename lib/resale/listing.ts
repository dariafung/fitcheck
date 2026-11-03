// A passing-on item's listing: the asking price (US dollars, stored in
// cents) and its condition. No server-only imports: the item page's forms
// use this too.
import { z } from "zod";

export const CONDITIONS = ["new_with_tags", "like_new", "good", "fair"] as const;
export const Condition = z.enum(CONDITIONS);
export type Condition = z.infer<typeof Condition>;

export const CONDITION_LABELS: Record<Condition, string> = {
  new_with_tags: "New with tags",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

// Same limit as the items.asking_price_cents column check: $100,000.
export const MAX_ASKING_PRICE_CENTS = 10_000_000;
export const AskingPriceCents = z.number().int().min(0).max(MAX_ASKING_PRICE_CENTS);

// "$25" for whole dollars, "$24.50" otherwise.
export function priceText(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

// A typed price ("25", "$24.5", "24.50") in cents, or null when it isn't
// one: at most two decimals, never negative, within the column's limit.
export function parsePrice(typed: string): number | null {
  const text = typed.trim().replace(/^\$\s*/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return AskingPriceCents.safeParse(cents).success ? cents : null;
}

// The price as typed back into the form: "25" or "24.50".
export function priceInput(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

// "Asking $25 · Like new", or whichever half is known; null with neither.
export function listingText(cents: number | null, condition: string | null): string | null {
  const parts = [
    cents === null ? null : `Asking ${priceText(cents)}`,
    Condition.safeParse(condition).success ? CONDITION_LABELS[condition as Condition] : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
