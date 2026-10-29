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
  ai_tags: unknown;
  user_tags: unknown;
}

export interface ItemRowUpdate {
  title?: string;
  brand?: string | null;
  category?: string;
  status?: string;
  user_tags?: { [key: string]: Json };
}

// The columns a patch changes, or null when it changes nothing (so an
// unchanged save doesn't bump updated_at and send pairings back to the model).
// Tags are stored the way a new item stores them: only the fields that differ
// from the AI's go into user_tags, so setting a field back to the AI's value
// drops the correction. The category column follows the edited tags.
export function itemUpdate(row: EditableRow, patch: ItemPatch): ItemRowUpdate | null {
  const next: ItemRowUpdate = {};
  if (patch.status !== undefined && patch.status !== row.status) next.status = patch.status;

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
