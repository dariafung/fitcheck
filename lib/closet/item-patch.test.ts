import { describe, expect, it } from "vitest";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { ItemPatch } from "./item-patch";

const TAGS: ItemTags = {
  category: "top",
  colors: [{ name: "white" }],
  materials: ["cotton"],
  formality: 3,
  tempRangeF: { min: 40, max: 70 },
  occasions: ["work"],
};

function details(over: Record<string, unknown> = {}) {
  return { title: "Linen shirt", brand: "Uniqlo", tags: TAGS, ...over };
}

describe("ItemPatch", () => {
  it("accepts details, a status, or both", () => {
    expect(ItemPatch.parse({ details: details() })).toEqual({ details: details() });
    expect(ItemPatch.parse({ status: "passing_on" })).toEqual({ status: "passing_on" });
    expect(ItemPatch.parse({ status: "active", details: details() }).status).toBe("active");
  });

  it("takes a size as typed, trimmed; empty or null clears it", () => {
    expect(ItemPatch.parse({ size: "  US 8 " })).toEqual({ size: "US 8" });
    expect(ItemPatch.parse({ status: "passing_on", size: "M" })).toEqual({ status: "passing_on", size: "M" });
    expect(ItemPatch.parse({ size: "  " })).toEqual({ size: null });
    expect(ItemPatch.parse({ size: null })).toEqual({ size: null });
    expect(ItemPatch.safeParse({ size: "x".repeat(21) }).success).toBe(false);
    expect(ItemPatch.safeParse({ size: 8 }).success).toBe(false);
  });

  it("trims the name and turns an empty brand into none", () => {
    const parsed = ItemPatch.parse({ details: details({ title: "  Linen shirt ", brand: "  " }) });
    expect(parsed.details).toMatchObject({ title: "Linen shirt", brand: null });
    expect(ItemPatch.parse({ details: details({ brand: null }) }).details?.brand).toBeNull();
  });

  it("rejects an empty patch, unknown fields and unknown statuses", () => {
    expect(ItemPatch.safeParse({}).success).toBe(false);
    expect(ItemPatch.safeParse({ tempRangeF: { min: 40, max: 70 } }).success).toBe(false);
    expect(ItemPatch.safeParse({ status: "active", title: "x" }).success).toBe(false);
    expect(ItemPatch.safeParse({ details: details({ price: 10 }) }).success).toBe(false);
    expect(ItemPatch.safeParse({ status: "candidate" }).success).toBe(false);
    expect(ItemPatch.safeParse({ status: "idle" }).success).toBe(false);
  });

  it("rejects a blank name, a missing brand key and bad tags", () => {
    expect(ItemPatch.safeParse({ details: details({ title: "   " }) }).success).toBe(false);
    expect(ItemPatch.safeParse({ details: { title: "x", tags: TAGS } }).success).toBe(false);
    expect(ItemPatch.safeParse({ details: details({ tags: { ...TAGS, formality: 6 } }) }).success).toBe(false);
    expect(ItemPatch.safeParse({ details: details({ tags: { ...TAGS, category: "hat" } }) }).success).toBe(false);
  });

  it("checks the temperature range the same way as everywhere else", () => {
    const withRange = (min: number, max: number) =>
      ItemPatch.safeParse({ details: details({ tags: { ...TAGS, tempRangeF: { min, max } } }) }).success;
    expect(withRange(55, 55)).toBe(true);
    expect(withRange(70, 40)).toBe(false);
    expect(withRange(40.5, 70)).toBe(false);
    expect(withRange(-40, 70)).toBe(false);
  });
});
