// The pure parts of "an outfit for a piece you're unhappy with": what sets
// it off, which closet items the model may choose from, the cache key, and
// checking the model's answer. fix-outfit-store.ts does the reading and
// writing.
import type { z } from "zod";
import { inputHash } from "@/lib/ai/hash";
import { FeelingStructured } from "@/lib/ai/schemas/common";
import {
  MAX_FIX_ITEMS,
  PROMPT_VERSION,
  PickFixOutfitInput,
  type FixComplaint,
  type PickFixOutfitOutput,
} from "@/lib/ai/schemas/pick-fix-outfit";
import { enumerateOutfits } from "@/lib/check/outfits";
import { isComplementary, temperaturesFit } from "@/lib/check/rules";
import { categoryOf, type ClosetItem } from "@/lib/check/types";

export type FixInput = z.output<typeof PickFixOutfitInput>;

// 1 or 2 stars of 5 counts as unhappy with the piece.
export const LOW_RATING_MAX = 2;

export function isLowRating(rating: number | null | undefined): boolean {
  return typeof rating === "number" && rating >= 1 && rating <= LOW_RATING_MAX;
}

// The bad things a parsed feeling says about its item, in the note's order.
// Empty for a feeling that isn't parsed or says nothing bad.
export function negativeAspects(structured: unknown): FixComplaint[] {
  const parsed = FeelingStructured.safeParse(structured);
  if (!parsed.success) return [];
  return parsed.data.aspects
    .filter((a) => a.sentiment === "negative")
    .map((a) => ({ aspect: a.aspect, ...(a.area && { area: a.area }), said: a.said, means: a.means }));
}

// Sorted and unique: how an outfit is stored, and what makes two the same.
export function outfitKey(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.toLowerCase()))].sort();
}

const SLOTS: readonly string[] = ["top", "one_piece", "bottom", "shoes", "outerwear"];
const byId = (a: ClosetItem, b: ClosetItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
// Outfit shapes only: whether the pieces go together is the model's call.
const anyPair = () => true;

// The other closet items the model may build the outfit from, picked for
// free: only categories that can share an outfit with the item (so never
// accessories), and only items with a temperature in common with it. Listed
// by category, then id. With more than `max`, each category keeps its first
// items by id, taken a category at a time so none is cut out.
export function fixCloset(item: ClosetItem, closet: readonly ClosetItem[], max = MAX_FIX_ITEMS): ClosetItem[] {
  const seen = new Set([item.id]);
  const groups = SLOTS.map((slot) =>
    closet
      .filter((other) => {
        if (seen.has(other.id) || categoryOf(other) !== slot) return false;
        seen.add(other.id);
        return isComplementary(categoryOf(item), categoryOf(other)) && temperaturesFit(item, other);
      })
      .sort(byId),
  );
  const kept: ClosetItem[][] = groups.map(() => []);
  let left = max;
  for (let round = 0; left > 0 && groups.some((g) => g.length > round); round++) {
    for (const [i, group] of groups.entries()) {
      if (left > 0 && group.length > round) {
        kept[i].push(group[round]);
        left -= 1;
      }
    }
  }
  return kept.flat();
}

// Whether the item and the listed items can make any complete outfit (top +
// bottom + shoes, or one-piece + shoes). False, say, with no shoes: then
// there is nothing to ask the model.
export function canComplete(item: ClosetItem, list: readonly ClosetItem[]): boolean {
  return enumerateOutfits([item, ...list], anyPair).outfits.some((o) => o.itemIds.includes(item.id));
}

const summary = (item: ClosetItem) => ({ id: item.id, title: item.title, tags: item.tags });

// What pickFixOutfit sees, without the photo.
export function fixInput(
  item: ClosetItem,
  complaints: readonly FixComplaint[],
  lowRating: boolean,
  list: readonly ClosetItem[],
): FixInput {
  return PickFixOutfitInput.parse({ item: summary(item), complaints, lowRating, closet: list.map(summary) });
}

// Covers whether the item is rated low (not the number of stars), the
// complaints, the listed items with the tags sent, and the prompt version:
// the suggestion is asked for again only when this changes. The photo is
// left out, so a cached answer needs no photo read.
export function fixHash(input: FixInput): string {
  return inputHash("pickFixOutfit", PROMPT_VERSION, { ...input, item: { ...input.item, photo: undefined } });
}

export interface PickedOutfit {
  // Slot order: top, bottom, shoes[, outerwear] or one-piece, shoes[, outerwear].
  itemIds: string[];
  reason: string;
}

// The outfit the model picked, or null: it said nothing helps, named an item
// that isn't in the list, gave no reason, or its pieces with the item don't
// make exactly one complete outfit (a slot missing or filled twice, an
// accessory, no temperature in common). Only listed items can come out of
// this, whatever the model wrote.
export function pickedOutfit(output: PickFixOutfitOutput, item: ClosetItem, list: readonly ClosetItem[]): PickedOutfit | null {
  const reason = output.reason.trim();
  const ids = output.itemIds.map((id) => id.toLowerCase());
  if (ids.length === 0 || !reason || new Set(ids).size !== ids.length) return null;
  const picked = ids.map((id) => list.find((other) => other.id === id && other.id !== item.id));
  if (picked.some((p) => !p)) return null;
  const pieces = [item, ...(picked as ClosetItem[])];
  const outfit = enumerateOutfits(pieces, anyPair).outfits.find((o) => o.itemIds.length === pieces.length);
  return outfit ? { itemIds: [...outfit.itemIds], reason } : null;
}
