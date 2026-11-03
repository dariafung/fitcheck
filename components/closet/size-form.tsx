"use client";

// Saving an item's size, listing and status from the item page.
import { DEMO_READ_ONLY } from "@/lib/auth/messages";
import { SAVE_FAILED } from "@/components/entry/messages";

export const SIZE_FIRST = "Add a size first.";

export const LISTING_FIRST = "Add a price and a condition first.";

// Sends a size, a listing (price and condition) and/or a status to the item;
// the problem to show, or null.
export async function patchItem(
  itemId: string,
  body: { status?: string; size?: string; askingPriceCents?: number; condition?: string },
): Promise<string | null> {
  const res = await fetch(`/api/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (res?.ok) return null;
  if (res?.status === 403) return DEMO_READ_ONLY;
  if (res?.status === 400) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    if (error === "size_required") return SIZE_FIRST;
    if (error === "listing_required") return LISTING_FIRST;
  }
  return SAVE_FAILED;
}
