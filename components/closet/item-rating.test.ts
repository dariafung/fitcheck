import { describe, expect, it } from "vitest";
import { ItemPatch } from "@/lib/closet/item-patch";
import { itemUpdate, type EditableRow } from "@/lib/closet/item-update";
import { nextRating, ratingLabel } from "./item-rating";

const ROW: EditableRow = {
  title: "Tee",
  brand: null,
  category: "top",
  status: "active",
  size: null,
  asking_price_cents: null,
  condition: null,
  rating: 3,
  ai_tags: null,
  user_tags: {},
};

describe("item rating", () => {
  it("saves the tapped star, or clears the rating when it is the current one", () => {
    expect(nextRating(null, 4)).toBe(4);
    expect(nextRating(2, 5)).toBe(5);
    expect(nextRating(3, 3)).toBeNull();
  });

  it("says the rating in words", () => {
    expect(ratingLabel(3)).toBe("3 of 5 stars");
    expect(ratingLabel(null)).toBe("Not rated");
  });
});

describe("rating through the item patch", () => {
  it("accepts 1 to 5 stars or null, alone", () => {
    for (const rating of [1, 5, null]) expect(ItemPatch.safeParse({ rating }).success).toBe(true);
    for (const rating of [0, 6, 2.5, "3"]) expect(ItemPatch.safeParse({ rating }).success).toBe(false);
    expect(ItemPatch.safeParse({}).success).toBe(false);
  });

  it("writes the column only when the rating changes", () => {
    expect(itemUpdate(ROW, ItemPatch.parse({ rating: 1 }))).toEqual({ rating: 1 });
    expect(itemUpdate(ROW, ItemPatch.parse({ rating: null }))).toEqual({ rating: null });
    expect(itemUpdate(ROW, ItemPatch.parse({ rating: 3 }))).toBeNull();
    expect(itemUpdate({ ...ROW, rating: null }, ItemPatch.parse({ rating: null }))).toBeNull();
    expect(itemUpdate({ ...ROW, rating: undefined }, ItemPatch.parse({ rating: null }))).toBeNull();
  });
});
