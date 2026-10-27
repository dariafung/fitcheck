import { describe, expect, it } from "vitest";
import type { Category, LifestyleMix, Occasion } from "../ai/schemas/common";
import { SAMPLE_CLOSET } from "./fixtures";
import {
  duplicateTier,
  findDuplicate,
  missingSlots,
  occasionGap,
  occasionTier,
  revivedItemIds,
} from "./gaps";
import { CANDIDATE_ITEM_ID } from "./pairings";
import { pairKey, toClosetItem, type ClosetItem, type Compatible } from "./types";

let next = 0;
function item(
  category: Category,
  over: { colorFamily?: string; fit?: string; subcategory?: string } = {},
): ClosetItem {
  next += 1;
  const id = `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
  const made = toClosetItem(id, `${category} ${next}`, {
    category, colors: [], materials: [], formality: 3, occasions: [], ...over,
  });
  if (!made) throw new Error("bad tags");
  return made;
}

const candidateOf = (category: Category, over = {}) => ({ ...item(category, over), id: CANDIDATE_ITEM_ID });

const mix = (over: Partial<LifestyleMix> = {}): LifestyleMix => ({
  work: 0, school: 0, social: 0, sport: 0, home: 0, ...over,
});
const counts = (over: Partial<Record<Occasion, number>> = {}) => ({
  work: 0, school: 0, social: 0, sport: 0, home: 0, ...over,
});

describe("occasionGap", () => {
  it("tiers one occasion against the outfits wanted", () => {
    expect(occasionTier(2, 2, 4)).toBe("none");
    expect(occasionTier(0, 1, 4)).toBe("from_zero");
    expect(occasionTier(3, 5, 4)).toBe("more_outfits");
    expect(occasionTier(4, 5, 4)).toBe("already_enough");
    // An occasion the user wants nothing for doesn't count.
    expect(occasionTier(0, 2, 0)).toBe("none");
  });

  it("looks at every occasion and takes the best tier", () => {
    const m = mix({ school: 3, home: 2, sport: 1 });
    const result = occasionGap(
      m,
      counts({ school: 1, home: 0, sport: 4, work: 0 }),
      // Work wants nothing, so its new outfits don't count.
      counts({ school: 2, home: 1, sport: 6, work: 3 }),
    );
    expect(result.tier).toBe("from_zero");
    expect(result.occasions.map((o) => [o.occasion, o.tier, o.wanted])).toEqual([
      ["home", "from_zero", 2],
      ["school", "more_outfits", 3],
      ["sport", "already_enough", 1],
    ]);
  });

  it("is none when nothing is added, or without a mix", () => {
    expect(occasionGap(mix({ school: 3 }), counts({ school: 1 }), counts({ school: 1 }))).toEqual({
      tier: "none",
      occasions: [],
    });
    expect(occasionGap(null, counts(), counts({ work: 3 }))).toEqual({ tier: "none", occasions: [] });
  });
});

describe("revivedItemIds", () => {
  it("counts owned items that go from 0 to some, never the candidate", () => {
    const before = { a: 0, b: 2, c: 0 };
    const after = { a: 1, b: 3, c: 0, [CANDIDATE_ITEM_ID]: 4 };
    expect(revivedItemIds(before, after)).toEqual(["a"]);
  });
});

describe("duplicates", () => {
  it("near identical: same category, color family and fit", () => {
    const owned = item("top", { colorFamily: "white", fit: "regular", subcategory: "T-shirt" });
    expect(duplicateTier(candidateOf("top", { colorFamily: "white", fit: "regular", subcategory: "t shirt" }), owned)).toBe("near_identical");
    expect(duplicateTier(candidateOf("top", { colorFamily: "white", fit: "regular" }), owned)).toBe("near_identical");
  });

  it("similar: same category and color family only", () => {
    const owned = item("top", { colorFamily: "white", fit: "regular", subcategory: "t-shirt" });
    expect(duplicateTier(candidateOf("top", { colorFamily: "white", fit: "slim" }), owned)).toBe("similar");
    expect(duplicateTier(candidateOf("top", { colorFamily: "white", fit: "regular", subcategory: "blouse" }), owned)).toBe("similar");
    expect(duplicateTier(candidateOf("top", { colorFamily: "white" }), owned)).toBe("similar");
  });

  it("none: other category or color, or no color family", () => {
    const owned = item("top", { colorFamily: "white", fit: "regular" });
    expect(duplicateTier(candidateOf("bottom", { colorFamily: "white", fit: "regular" }), owned)).toBe("none");
    expect(duplicateTier(candidateOf("top", { colorFamily: "black", fit: "regular" }), owned)).toBe("none");
    expect(duplicateTier(candidateOf("top", { fit: "regular" }), item("top", { fit: "regular" }))).toBe("none");
  });

  it("finds the closest owned item", () => {
    const similar = item("top", { colorFamily: "white" });
    const same = item("top", { colorFamily: "white", fit: "slim" });
    const result = findDuplicate(candidateOf("top", { colorFamily: "white", fit: "slim" }), [similar, same]);
    expect(result).toEqual({ tier: "near_identical", item: same });
    expect(findDuplicate(candidateOf("shoes", { colorFamily: "white" }), [similar]).tier).toBe("none");
  });

  it("flags the sample closet's white sneakers", () => {
    const sneakers = candidateOf("shoes", { colorFamily: "white" });
    expect(findDuplicate(sneakers, SAMPLE_CLOSET).item?.title).toBe("White leather sneakers");
  });
});

describe("missingSlots", () => {
  const always: Compatible = () => true;
  // The candidate goes only with `ok`; owned items all go together.
  const only = (...ok: ClosetItem[]): Compatible => {
    const allowed = new Set(ok.map((i) => i.id));
    return (a, b) => {
      if (a.id === CANDIDATE_ITEM_ID) return allowed.has(b.id);
      if (b.id === CANDIDATE_ITEM_ID) return allowed.has(a.id);
      return true;
    };
  };

  it("names slots the closet has nothing in", () => {
    const top = candidateOf("top");
    expect(missingSlots(top, [item("bottom")], always)).toEqual([{ category: "shoes", owned: false }]);
  });

  it("names slots where nothing goes with it", () => {
    const top = candidateOf("top");
    const bottom = item("bottom");
    const shoes = item("shoes");
    expect(missingSlots(top, [bottom, shoes], only(bottom))).toEqual([{ category: "shoes", owned: true }]);
  });

  it("picks the alternative closest to complete for shoes", () => {
    const shoes = candidateOf("shoes");
    expect(missingSlots(shoes, [item("one_piece")], always)).toEqual([]);
    // A tie (one missing either way) goes to top + bottom.
    expect(missingSlots(shoes, [item("top")], always)).toEqual([{ category: "bottom", owned: false }]);
    // Fewer missing wins: one one-piece beats a top and a bottom.
    expect(missingSlots(shoes, [], always)).toEqual([{ category: "one_piece", owned: false }]);
    expect(missingSlots(candidateOf("top"), [], always)).toEqual([
      { category: "bottom", owned: false },
      { category: "shoes", owned: false },
    ]);
  });

  it("is empty when every slot has a match that doesn't go together", () => {
    const top = candidateOf("top");
    const bottom = item("bottom");
    const shoes = item("shoes");
    const blocked = pairKey(bottom.id, shoes.id);
    const compatible: Compatible = (a, b) => pairKey(a.id, b.id) !== blocked;
    expect(missingSlots(top, [bottom, shoes], compatible)).toEqual([]);
  });

  it("needs a base outfit for outerwear", () => {
    const coat = candidateOf("outerwear");
    expect(missingSlots(coat, [item("one_piece")], always)).toEqual([{ category: "shoes", owned: false }]);
  });
});
