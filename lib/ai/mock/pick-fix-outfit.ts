import type { z } from "zod";
import { enumerateOutfits } from "../../check/outfits";
import { toClosetItem, type ClosetItem } from "../../check/types";
import type { ItemSummary } from "../schemas/common";
import type { PickFixOutfitInput, PickFixOutfitOutput } from "../schemas/pick-fix-outfit";

const NONE = { itemIds: [], reason: "" };

function closetItem(item: ItemSummary): ClosetItem[] {
  const parsed = toClosetItem(item.id, item.title, item.tags);
  return parsed ? [parsed] : [];
}

// By rule, not at random: the first complete outfit that contains the piece,
// in the enumeration's order (ids sorted). Written complaints that are all
// of the "other" kind get no pick, so the nothing-helps answer can be reached
// without a real model.
export function mockPickFixOutfit(input: z.output<typeof PickFixOutfitInput>): z.input<typeof PickFixOutfitOutput> {
  if (input.complaints.length > 0 && input.complaints.every((c) => c.aspect === "other")) return NONE;
  const all = [input.item, ...input.closet].flatMap(closetItem);
  const outfit = enumerateOutfits(all, () => true).outfits.find((o) => o.itemIds.includes(input.item.id));
  if (!outfit) return NONE;
  const itemIds = outfit.itemIds.filter((id) => id !== input.item.id);
  const helper = input.closet.find((item) => item.id === itemIds[0]);
  // A long product name is cut so the line stays within the word limit.
  const name = (helper?.title ?? "rest").split(/\s+/).slice(0, 8).join(" ");
  const reason = input.complaints.length > 0 ? `Mock: the ${name} takes care of it.` : `Mock: the ${name} shows it at its best.`;
  return { itemIds, reason };
}
