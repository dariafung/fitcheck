import { stableStringify } from "@/lib/ai/hash";
import type { Json } from "@/lib/db/database.types";
import { changedTags } from "@/lib/entry/tags";
import type { ItemPatch } from "./item-patch";
import { aiTags } from "./tags";

// The columns an edit can touch, as stored.
export interface EditableRow {
  title: string;
  brand: string | null;
  category: string;
  status: string;
  size: string | null;
  asking_price_cents: number | null;
  condition: string | null;
  ai_tags: unknown;
  user_tags: unknown;
}

export interface ItemRowUpdate {
  title?: string;
  brand?: string | null;
  category?: string;
  status?: string;
  size?: string | null;
  asking_price_cents?: number | null;
  condition?: string | null;
  user_tags?: { [key: string]: Json };
}

// An item on its way out (passing_on) needs a size, so buyers can be matched
// by it. True when the patch would put an item there without one, or take
// the size off one that is there. Items passed on before sizes existed can
// still be edited without adding one.
export function needsSize(row: EditableRow, patch: ItemPatch): boolean {
  const status = patch.status ?? row.status;
  const size = patch.size === undefined ? row.size : patch.size;
  if (status !== "passing_on" || size !== null) return false;
  return row.status !== "passing_on" || patch.size === null;
}

// Passing an item on also needs an asking price and a condition. True when
// the patch would put an item there without both, or take either off one
// that is there. Items passed on before listings existed can still be edited
// without adding them, like sizes.
export function needsListing(row: EditableRow, patch: ItemPatch): boolean {
  const status = patch.status ?? row.status;
  if (status !== "passing_on") return false;
  const price = patch.askingPriceCents === undefined ? row.asking_price_cents : patch.askingPriceCents;
  const condition = patch.condition === undefined ? row.condition : patch.condition;
  if (price !== null && condition !== null) return false;
  return row.status !== "passing_on" || patch.askingPriceCents === null || patch.condition === null;
}

// The columns a patch changes, or null when it changes nothing (so an
// unchanged save doesn't bump updated_at and send pairings back to the model).
// Tags are stored the way a new item stores them: only the fields that differ
// from the AI's go into user_tags, so setting a field back to the AI's value
// drops the correction. The category column follows the edited tags.
export function itemUpdate(row: EditableRow, patch: ItemPatch): ItemRowUpdate | null {
  const next: ItemRowUpdate = {};
  if (patch.status !== undefined && patch.status !== row.status) next.status = patch.status;
  if (patch.size !== undefined && patch.size !== row.size) next.size = patch.size;
  if (patch.askingPriceCents !== undefined && patch.askingPriceCents !== row.asking_price_cents) {
    next.asking_price_cents = patch.askingPriceCents;
  }
  if (patch.condition !== undefined && patch.condition !== row.condition) next.condition = patch.condition;

  const details = patch.details;
  if (details) {
    if (details.title !== row.title) next.title = details.title;
    if (details.brand !== row.brand) next.brand = details.brand;
    if (details.tags.category !== row.category) next.category = details.tags.category;
    const userTags = changedTags(aiTags(row), details.tags);
    if (stableStringify(userTags) !== stableStringify(row.user_tags ?? {})) {
      next.user_tags = userTags as { [key: string]: Json };
    }
  }
  return Object.keys(next).length > 0 ? next : null;
}
