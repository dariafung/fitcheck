import { describe, expect, it } from "vitest";
import { ItemPatch } from "@/lib/closet/item-patch";
import { itemUpdate, type EditableRow } from "@/lib/closet/item-update";
import { nextSizeFit } from "./item-size-fit";

const ROW: EditableRow = {
  title: "Tee",
  brand: null,
  category: "top",
  status: "active",
  size: "S",
  asking_price_cents: null,
  condition: null,
  rating: 3,
  size_fit: "right",
  ai_tags: null,
  user_tags: {},
};

describe("item size fit", () => {
  it("saves the tapped answer, or clears it when it is the current one", () => {
    expect(nextSizeFit(null, "small")).toBe("small");
    expect(nextSizeFit("small", "right")).toBe("right");
    expect(nextSizeFit("large", "large")).toBeNull();
  });

  it("goes through the item patch, alone or cleared", () => {
    for (const sizeFit of ["small", "right", "large", null]) expect(ItemPatch.safeParse({ sizeFit }).success).toBe(true);
    for (const sizeFit of ["tight", "", 1]) expect(ItemPatch.safeParse({ sizeFit }).success).toBe(false);
  });

  it("writes the column only when it changes", () => {
    expect(itemUpdate(ROW, ItemPatch.parse({ sizeFit: "small" }))).toEqual({ size_fit: "small" });
    expect(itemUpdate(ROW, ItemPatch.parse({ sizeFit: null }))).toEqual({ size_fit: null });
    expect(itemUpdate(ROW, ItemPatch.parse({ sizeFit: "right" }))).toBeNull();
    expect(itemUpdate({ ...ROW, size_fit: undefined }, ItemPatch.parse({ sizeFit: null }))).toBeNull();
  });
});
