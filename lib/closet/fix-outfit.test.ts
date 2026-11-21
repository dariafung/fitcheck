import { describe, expect, it } from "vitest";
import type { FeelingStructured, ItemTags } from "@/lib/ai/schemas/common";
import { MAX_FIX_ITEMS } from "@/lib/ai/schemas/pick-fix-outfit";
import type { ClosetItem } from "@/lib/check/types";
import { canComplete, fixCloset, fixHash, fixInput, isLowRating, negativeAspects, outfitKey, pickedOutfit } from "./fix-outfit";

let next = 0;
function item(category: ItemTags["category"], title: string, tempRangeF?: { min: number; max: number }): ClosetItem {
  next += 1;
  const id = `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
  return { id, title, tags: { category, colors: [], materials: [], formality: 2, occasions: [], ...(tempRangeF && { tempRangeF }) }, tempRangeF };
}

const feeling = (aspects: FeelingStructured["aspects"]): FeelingStructured => ({
  flattering: "mixed",
  liked: "mixed",
  aspects,
  occasions: [],
  mood: [],
  summary: "s",
});

const TEE = item("top", "White tee");
const SHIRT = item("top", "Blue shirt");
const JEANS = item("bottom", "Jeans");
const SKIRT = item("bottom", "Skirt");
const SNEAKERS = item("shoes", "Sneakers");
const BOOTS = item("shoes", "Boots");
const BLAZER = item("outerwear", "Black blazer");
const DRESS = item("one_piece", "Slip dress");
const SCARF = item("accessory", "Scarf");
const CLOSET = [SCARF, DRESS, BLAZER, BOOTS, SNEAKERS, SKIRT, JEANS, SHIRT, TEE];
const COMPLAINTS = [{ aspect: "color" as const, said: "washes me out", means: "pale near the face" }];
const ids = (list: ClosetItem[]) => list.map((i) => i.id);

describe("isLowRating", () => {
  it("is 1 or 2 stars", () => {
    expect([1, 2].map(isLowRating)).toEqual([true, true]);
    expect([3, 4, 5, 0, null, undefined].map(isLowRating)).toEqual([false, false, false, false, false, false]);
  });
});

describe("negativeAspects", () => {
  it("keeps only what the note says is bad, with the area when there is one", () => {
    const structured = feeling([
      { aspect: "color", sentiment: "positive", said: "love the color", means: "likes it" },
      { aspect: "fit", sentiment: "negative", area: "shoulders", said: "boxy", means: "shoulders run wide" },
      { aspect: "feel", sentiment: "negative", said: "see-through", means: "thin fabric" },
    ]);
    expect(negativeAspects(structured)).toEqual([
      { aspect: "fit", area: "shoulders", said: "boxy", means: "shoulders run wide" },
      { aspect: "feel", said: "see-through", means: "thin fabric" },
    ]);
  });

  it("is empty for only good aspects, no aspects, and a feeling that isn't parsed", () => {
    expect(negativeAspects(feeling([{ aspect: "color", sentiment: "positive", said: "a", means: "b" }]))).toEqual([]);
    expect(negativeAspects({ flattering: "yes", liked: "yes", occasions: [], mood: [], summary: "s" })).toEqual([]);
    expect(negativeAspects(null)).toEqual([]);
    expect(negativeAspects(undefined)).toEqual([]);
    expect(negativeAspects({ aspects: "nope" })).toEqual([]);
  });
});

describe("outfitKey", () => {
  it("sorts and drops repeats", () => {
    expect(outfitKey([JEANS.id, TEE.id, JEANS.id])).toEqual([TEE.id, JEANS.id]);
    expect(outfitKey([JEANS.id.toUpperCase(), TEE.id])).toEqual([TEE.id, JEANS.id]);
  });
});

describe("fixCloset", () => {
  it("keeps only categories that can share an outfit with the item, by category then id", () => {
    // A top goes with bottoms, shoes and a layer: no other top, dress or accessory.
    expect(ids(fixCloset(TEE, CLOSET))).toEqual(ids([JEANS, SKIRT, SNEAKERS, BOOTS, BLAZER]));
    expect(ids(fixCloset(DRESS, CLOSET))).toEqual(ids([SNEAKERS, BOOTS, BLAZER]));
    expect(ids(fixCloset(BLAZER, CLOSET))).toEqual(ids([TEE, SHIRT, DRESS, JEANS, SKIRT, SNEAKERS, BOOTS]));
    expect(ids(fixCloset(SNEAKERS, CLOSET))).toEqual(ids([TEE, SHIRT, DRESS, JEANS, SKIRT, BLAZER]));
    expect(fixCloset(SCARF, CLOSET)).toEqual([]);
  });

  it("gives the same list whatever order the closet comes in, without the item or repeats", () => {
    const shuffled = [JEANS, TEE, BOOTS, JEANS, BLAZER, SNEAKERS, SKIRT];
    expect(ids(fixCloset(TEE, shuffled))).toEqual(ids(fixCloset(TEE, CLOSET)));
  });

  it("drops items with no temperature in common", () => {
    const linenTee = item("top", "Linen tee", { min: 70, max: 95 });
    const woolPants = item("bottom", "Wool pants", { min: 20, max: 55 });
    const shorts = item("bottom", "Shorts", { min: 65, max: 100 });
    const parka = item("outerwear", "Parka", { min: 0, max: 40 });
    // The rules don't compare a layer's range with what it covers.
    expect(ids(fixCloset(linenTee, [woolPants, shorts, parka, SNEAKERS]))).toEqual(ids([shorts, SNEAKERS, parka]));
  });

  it("caps the list without cutting a category out", () => {
    const tops = Array.from({ length: 30 }, (_, i) => item("top", `Top ${i}`));
    const bottoms = Array.from({ length: 30 }, (_, i) => item("bottom", `Bottom ${i}`));
    const list = fixCloset(SNEAKERS, [...tops, ...bottoms, BLAZER, DRESS]);
    expect(list).toHaveLength(MAX_FIX_ITEMS);
    expect(list).toContain(BLAZER);
    expect(list).toContain(DRESS);
    expect(list.filter((i) => i.tags.category === "top")).toEqual(tops.slice(0, 19));
    expect(list.filter((i) => i.tags.category === "bottom")).toEqual(bottoms.slice(0, 19));
    expect(ids(fixCloset(SNEAKERS, [...bottoms, DRESS, BLAZER, ...tops].reverse()))).toEqual(ids(list));
    expect(fixCloset(SNEAKERS, [...tops, ...bottoms], 5)).toHaveLength(5);
  });
});

describe("canComplete", () => {
  it("needs a top, a bottom and shoes, or a one-piece and shoes", () => {
    expect(canComplete(TEE, [JEANS, SNEAKERS])).toBe(true);
    expect(canComplete(DRESS, [BOOTS])).toBe(true);
    expect(canComplete(BLAZER, [DRESS, BOOTS])).toBe(true);
    expect(canComplete(SNEAKERS, [DRESS])).toBe(true);
  });

  it("is false when a slot can't be filled", () => {
    expect(canComplete(TEE, [JEANS, SKIRT, BLAZER])).toBe(false);
    expect(canComplete(TEE, [SNEAKERS, BLAZER])).toBe(false);
    expect(canComplete(BLAZER, [JEANS, BOOTS])).toBe(false);
    expect(canComplete(TEE, [])).toBe(false);
  });
});

describe("fixInput and fixHash", () => {
  const list = fixCloset(TEE, CLOSET);

  it("lists the item, the complaints, the low-rating flag and the other items in order", () => {
    const input = fixInput(TEE, COMPLAINTS, false, list);
    expect(input.item).toMatchObject({ id: TEE.id, title: "White tee" });
    expect(input.item.photo).toBeUndefined();
    expect(input.complaints).toEqual(COMPLAINTS);
    expect(input.lowRating).toBe(false);
    expect(input.closet.map((i) => i.id)).toEqual(ids(list));
  });

  it("can't be built with neither a complaint nor a low rating", () => {
    expect(() => fixInput(TEE, [], false, list)).toThrow();
    expect(fixInput(TEE, [], true, list).complaints).toEqual([]);
  });

  it("gives the same hash for the same input, with or without the photo", () => {
    const input = fixInput(TEE, COMPLAINTS, true, list);
    expect(fixHash(fixInput(TEE, [...COMPLAINTS], true, [...list]))).toBe(fixHash(input));
    const photo = { kind: "inline" as const, mime: "image/webp", base64: "AAAA" };
    expect(fixHash({ ...input, item: { ...input.item, photo } })).toBe(fixHash(input));
  });

  it("changes the hash with the low-rating flag, a complaint, the listed items or their tags", () => {
    const hash = fixHash(fixInput(TEE, COMPLAINTS, false, list));
    expect(fixHash(fixInput(TEE, COMPLAINTS, true, list))).not.toBe(hash);
    expect(fixHash(fixInput(TEE, [{ ...COMPLAINTS[0], said: "too yellow" }], false, list))).not.toBe(hash);
    expect(fixHash(fixInput(TEE, [], true, list))).not.toBe(fixHash(fixInput(TEE, COMPLAINTS, true, list)));
    expect(fixHash(fixInput(TEE, COMPLAINTS, false, list.slice(1)))).not.toBe(hash);
    const edited = list.map((i) => (i.id === JEANS.id ? { ...i, tags: { ...i.tags, formality: 4 } } : i));
    expect(fixHash(fixInput(TEE, COMPLAINTS, false, edited))).not.toBe(hash);
  });
});

describe("pickedOutfit", () => {
  const list = fixCloset(TEE, CLOSET);
  const pick = (picked: ClosetItem[], reason = "The blazer adds contrast.") =>
    pickedOutfit({ itemIds: ids(picked), reason }, TEE, list);

  it("accepts a complete outfit around the item, in slot order", () => {
    expect(pick([SNEAKERS, JEANS], " The dark jeans add contrast. ")).toEqual({
      itemIds: ids([TEE, JEANS, SNEAKERS]),
      reason: "The dark jeans add contrast.",
    });
    expect(pick([BLAZER, BOOTS, SKIRT])?.itemIds).toEqual(ids([TEE, SKIRT, BOOTS, BLAZER]));
    const forDress = fixCloset(DRESS, CLOSET);
    expect(pickedOutfit({ itemIds: ids([BOOTS]), reason: "r" }, DRESS, forDress)?.itemIds).toEqual(ids([DRESS, BOOTS]));
    expect(pickedOutfit({ itemIds: ids([BLAZER, BOOTS]), reason: "r" }, DRESS, forDress)?.itemIds).toEqual(ids([DRESS, BOOTS, BLAZER]));
  });

  it("is no pick when the model says nothing helps or gives no reason", () => {
    expect(pick([])).toBeNull();
    expect(pick([JEANS, SNEAKERS], "  ")).toBeNull();
  });

  it("drops an outfit with a slot missing or filled twice", () => {
    expect(pick([JEANS])).toBeNull();
    expect(pick([JEANS, BLAZER])).toBeNull();
    expect(pick([JEANS, SKIRT, SNEAKERS])).toBeNull();
    expect(pick([JEANS, SNEAKERS, BOOTS])).toBeNull();
    expect(pick([JEANS, SNEAKERS, SNEAKERS])).toBeNull();
  });

  it("drops anything that isn't in the list: another top, a dress, an accessory, the item itself, an unknown id", () => {
    expect(pick([SHIRT, JEANS, SNEAKERS])).toBeNull();
    expect(pick([DRESS, SNEAKERS])).toBeNull();
    expect(pick([JEANS, SNEAKERS, SCARF])).toBeNull();
    expect(pick([TEE, JEANS, SNEAKERS])).toBeNull();
    expect(pickedOutfit({ itemIds: [JEANS.id, "99999999-0000-4000-8000-000000000000"], reason: "r" }, TEE, list)).toBeNull();
    // Even when the list passed in is wider than the pre-filter gives.
    expect(pickedOutfit({ itemIds: ids([JEANS, SNEAKERS, SCARF]), reason: "r" }, TEE, CLOSET)).toBeNull();
    expect(pickedOutfit({ itemIds: ids([SHIRT, JEANS, SNEAKERS]), reason: "r" }, TEE, CLOSET)).toBeNull();
  });

  it("drops pieces with no temperature in common", () => {
    const shorts = item("bottom", "Shorts", { min: 75, max: 100 });
    const boots = item("shoes", "Snow boots", { min: 0, max: 40 });
    expect(pickedOutfit({ itemIds: ids([shorts, boots]), reason: "r" }, TEE, [shorts, boots])).toBeNull();
  });
});
