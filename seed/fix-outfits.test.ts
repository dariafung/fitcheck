import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FIX_REASON_MAX_WORDS, wordCount } from "@/lib/ai/schemas/pick-fix-outfit";
import { toClosetItem, type ClosetItem } from "@/lib/check/types";
import { isLowRating, negativeAspects, pickedOutfit } from "@/lib/closet/fix-outfit";
import { ItemRating } from "@/lib/closet/item-patch";
import { itemTags } from "@/lib/closet/tags";
import feelings from "./feelings.json";
import fixes from "./fix-outfits.json";
import items from "./items.json";

const Fix = z.union([
  z.strictObject({ item_id: z.uuid(), outfit_item_ids: z.array(z.uuid()).min(2), reason: z.string().min(1) }),
  z.strictObject({ item_id: z.uuid(), outfit_item_ids: z.null(), reason: z.null() }),
]);

const rated = items as ((typeof items)[number] & { rating?: number })[];
const active = rated.filter((i) => i.status === "active");
const closet = active.flatMap((i): ClosetItem[] => {
  const item = toClosetItem(i.id, i.title, itemTags(i));
  return item ? [item] : [];
});
const complaintsOf = (id: string) => negativeAspects(feelings.find((f) => f.item_id === id)?.structured);

describe("seed ratings", () => {
  it("rates some items 1 to 5 stars, a few of them low, and leaves some unrated", () => {
    const ratings = rated.flatMap((i) => (i.rating === undefined ? [] : [ItemRating.parse(i.rating)]));
    expect(ratings.length).toBeLessThan(rated.length);
    expect(ratings.filter((r) => r >= 4).length).toBeGreaterThanOrEqual(3);
    expect(active.filter((i) => isLowRating(i.rating)).length).toBeGreaterThanOrEqual(2);
  });
});

describe("seed fix outfits", () => {
  it("has one valid row per item, each an active item rated low or with a complaint", () => {
    const ids = fixes.map((f) => Fix.parse(f).item_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const item = active.find((i) => i.id === id);
      expect(item).toBeDefined();
      expect(isLowRating(item?.rating) || complaintsOf(id).length > 0).toBe(true);
    }
  });

  it("covers every active item that is rated low or has a complaint", () => {
    const unhappy = active.filter((i) => isLowRating(i.rating) || complaintsOf(i.id).length > 0).map((i) => i.id);
    expect(fixes.map((f) => f.item_id).sort()).toEqual(unhappy.sort());
    // Both kinds are in the demo: a low rating with nothing bad written, and a complaint.
    expect(active.some((i) => isLowRating(i.rating) && complaintsOf(i.id).length === 0)).toBe(true);
    expect(active.some((i) => !isLowRating(i.rating) && complaintsOf(i.id).length > 0)).toBe(true);
  });

  it("suggests complete outfits of active items around the item", () => {
    const suggested = fixes.filter((f) => f.outfit_item_ids !== null);
    expect(suggested.length).toBeGreaterThanOrEqual(3);
    for (const fix of suggested) {
      const item = closet.find((i) => i.id === fix.item_id)!;
      expect(fix.outfit_item_ids).toContain(fix.item_id);
      const others = fix.outfit_item_ids!.filter((id) => id !== fix.item_id);
      expect(pickedOutfit({ itemIds: others, reason: fix.reason! }, item, closet)).not.toBeNull();
    }
  });

  it("gives each one short reason", () => {
    for (const fix of fixes) {
      if (fix.reason === null) continue;
      expect(wordCount(fix.reason)).toBeLessThanOrEqual(FIX_REASON_MAX_WORDS);
      expect(fix.reason).toMatch(/\.$/);
    }
  });
});
