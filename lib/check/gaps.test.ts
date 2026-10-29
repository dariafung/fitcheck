import { describe, expect, it } from "vitest";
import type { Category, LifestyleMix, Occasion } from "../ai/schemas/common";
import {
  gapKind,
  missingSlots,
  occasionGap,
  occasionTier,
  revivedItemIds,
  type MissingSlot,
} from "./gaps";
import { CANDIDATE_ITEM_ID } from "./pairings";
import { roundPart } from "./score";
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

  it("adds up every occasion, most points first", () => {
    const m = mix({ school: 3, home: 2, sport: 1 });
    const result = occasionGap(
      m,
      counts({ school: 1, home: 0, sport: 4, work: 0 }),
      // Work wants nothing, so its new outfits don't count.
      counts({ school: 2, home: 1, sport: 6, work: 3 }),
    );
    expect(result.tier).toBe("from_zero");
    expect(result.occasions.map((o) => [o.occasion, o.tier, o.wanted, roundPart(o.points)])).toEqual([
      // 2 of 2 short, adds 1.
      ["home", "from_zero", 2, 5],
      // 2 of 3 short, adds 1.
      ["school", "more_outfits", 3, 3.3],
      // Already had enough.
      ["sport", "already_enough", 1, 0],
    ]);
    expect(roundPart(result.points)).toBe(8.3);
  });

  it("caps the sum at the part's max", () => {
    const result = occasionGap(mix({ school: 10, home: 10 }), counts(), counts({ school: 3, home: 3 }));
    expect(result.points).toBe(15);
  });

  it("is none when nothing is added, or without a mix", () => {
    expect(occasionGap(mix({ school: 3 }), counts({ school: 1 }), counts({ school: 1 }))).toEqual({
      tier: "none",
      points: 0,
      occasions: [],
    });
    expect(occasionGap(null, counts(), counts({ work: 3 }))).toEqual({ tier: "none", points: 0, occasions: [] });
  });
});

describe("revivedItemIds", () => {
  it("counts owned items that go from 0 to some, never the candidate", () => {
    const before = { a: 0, b: 2, c: 0 };
    const after = { a: 1, b: 3, c: 0, [CANDIDATE_ITEM_ID]: 4 };
    expect(revivedItemIds(before, after)).toEqual(["a"]);
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

  const none = (category: Category): MissingSlot => ({ category, owned: false });

  it("names slots the closet has nothing in", () => {
    const top = candidateOf("top");
    expect(missingSlots(top, [item("bottom")], always)).toEqual([[none("shoes")]]);
  });

  it("names slots where nothing goes with it", () => {
    const top = candidateOf("top");
    const bottom = item("bottom");
    const shoes = item("shoes");
    expect(missingSlots(top, [bottom, shoes], only(bottom))).toEqual([[{ category: "shoes", owned: true }]]);
  });

  it("names what's missing for both ways to wear shoes", () => {
    const shoes = candidateOf("shoes");
    expect(missingSlots(shoes, [item("one_piece")], always)).toEqual([]);
    expect(missingSlots(shoes, [item("top")], always)).toEqual([[none("bottom")], [none("one_piece")]]);
    // Owning only shoes is the same as owning nothing.
    expect(missingSlots(shoes, [item("shoes")], always)).toEqual([[none("top"), none("bottom")], [none("one_piece")]]);
    expect(missingSlots(candidateOf("top"), [], always)).toEqual([[none("bottom"), none("shoes")]]);
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
    // Top + bottom + shoes needs everything one-piece + shoes does, so only
    // the shoes are named.
    expect(missingSlots(coat, [item("one_piece")], always)).toEqual([[none("shoes")]]);
    expect(missingSlots(coat, [], always)).toEqual([
      [none("top"), none("bottom"), none("shoes")],
      [none("one_piece"), none("shoes")],
    ]);
    expect(missingSlots(coat, [item("top"), item("bottom")], always)).toEqual([
      [none("shoes")],
    ]);
    expect(missingSlots(coat, [item("shoes")], always)).toEqual([
      [none("top"), none("bottom")],
      [none("one_piece")],
    ]);
  });
});

describe("gapKind", () => {
  it("tells a short closet from pieces that don't go with it", () => {
    const none = (category: Category): MissingSlot => ({ category, owned: false });
    expect(gapKind([[none("top"), none("bottom")], [none("one_piece")]])).toBe("nothing_owned");
    expect(gapKind([[{ category: "top", owned: true }], [none("one_piece")]])).toBe("no_match");
    expect(gapKind([])).toBe("no_match");
  });
});
