import { describe, expect, it } from "vitest";
import { pickFixOutfit } from "../index";
import type { ItemSummary, ItemTags } from "../schemas/common";
import { FIX_REASON_WORD_LIMIT, PickFixOutfitInput, PickFixOutfitOutput, wordCount } from "../schemas/pick-fix-outfit";
import { mockPickFixOutfit } from "./pick-fix-outfit";

let next = 0;
function item(category: ItemTags["category"], title: string): ItemSummary {
  next += 1;
  const id = `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
  return { id, title, tags: { category, colors: [], materials: [], formality: 2, occasions: [] } };
}

const TEE = item("top", "White tee");
const JEANS = item("bottom", "Jeans");
const SKIRT = item("bottom", "Skirt");
const SNEAKERS = item("shoes", "Sneakers");
const BLAZER = item("outerwear", "Black blazer");
const BAD_COLOR = [{ aspect: "color" as const, said: "washes me out", means: "pale near the face" }];
const CLOSET = [BLAZER, SNEAKERS, SKIRT, JEANS];

describe("mockPickFixOutfit", () => {
  it("picks the first complete outfit around the piece, whatever order the list is in", () => {
    const expected = { itemIds: [JEANS.id, SNEAKERS.id], reason: "Mock: the Jeans takes care of it." };
    expect(mockPickFixOutfit({ item: TEE, complaints: BAD_COLOR, lowRating: false, closet: CLOSET })).toEqual(expected);
    expect(mockPickFixOutfit({ item: TEE, complaints: BAD_COLOR, lowRating: true, closet: [...CLOSET].reverse() })).toEqual(expected);
  });

  it("speaks of the outfit, not a fault, for a low rating with no complaint", () => {
    expect(mockPickFixOutfit({ item: TEE, complaints: [], lowRating: true, closet: CLOSET })).toEqual({
      itemIds: [JEANS.id, SNEAKERS.id],
      reason: "Mock: the Jeans shows it at its best.",
    });
  });

  it("says nothing helps when the list can't complete an outfit", () => {
    expect(mockPickFixOutfit({ item: TEE, complaints: BAD_COLOR, lowRating: false, closet: [JEANS, BLAZER] })).toEqual({ itemIds: [], reason: "" });
  });

  it("says nothing helps when every written complaint is of the 'other' kind", () => {
    const complaints = [{ aspect: "other" as const, said: "itchy tag", means: "the tag scratches" }];
    expect(mockPickFixOutfit({ item: TEE, complaints, lowRating: true, closet: CLOSET })).toEqual({ itemIds: [], reason: "" });
  });

  it("stays within the word limit with a very long product name", () => {
    const long = item("bottom", Array.from({ length: 40 }, (_, i) => `word${i}`).join(" "));
    const out = mockPickFixOutfit({ item: TEE, complaints: BAD_COLOR, lowRating: false, closet: [long, SNEAKERS] });
    expect(out.itemIds).toEqual([long.id, SNEAKERS.id]);
    expect(wordCount(out.reason)).toBeLessThanOrEqual(FIX_REASON_WORD_LIMIT);
  });

  it("answers through the AI layer in mock mode", async () => {
    const out = await pickFixOutfit({ item: TEE, complaints: BAD_COLOR, lowRating: false, closet: CLOSET }, { mode: "mock" });
    expect(out.itemIds).toEqual([JEANS.id, SNEAKERS.id]);
  });
});

describe("pickFixOutfit schemas", () => {
  it("needs a complaint or a low rating", () => {
    expect(PickFixOutfitInput.safeParse({ item: TEE, complaints: [], lowRating: false, closet: CLOSET }).success).toBe(false);
    expect(PickFixOutfitInput.safeParse({ item: TEE, complaints: [], lowRating: true, closet: CLOSET }).success).toBe(true);
    expect(PickFixOutfitInput.safeParse({ item: TEE, complaints: BAD_COLOR, lowRating: false, closet: [] }).success).toBe(false);
  });

  it("needs a reason with a pick, within the word limit", () => {
    expect(PickFixOutfitOutput.safeParse({ itemIds: [JEANS.id], reason: "The jeans add contrast." }).success).toBe(true);
    expect(PickFixOutfitOutput.safeParse({ itemIds: [], reason: "" }).success).toBe(true);
    expect(PickFixOutfitOutput.safeParse({ itemIds: [JEANS.id], reason: " " }).success).toBe(false);
    expect(PickFixOutfitOutput.safeParse({ itemIds: ["jeans"], reason: "r" }).success).toBe(false);
    const long = Array.from({ length: FIX_REASON_WORD_LIMIT + 1 }, () => "word").join(" ");
    expect(PickFixOutfitOutput.safeParse({ itemIds: [JEANS.id], reason: long }).success).toBe(false);
  });
});
