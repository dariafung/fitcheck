import { describe, expect, it } from "vitest";
import { ItemPatch } from "./item-patch";

describe("ItemPatch", () => {
  it("accepts a whole-degree range", () => {
    expect(ItemPatch.parse({ tempRangeF: { min: 40, max: 70 } })).toEqual({ tempRangeF: { min: 40, max: 70 } });
    expect(ItemPatch.parse({ tempRangeF: { min: 55, max: 55 } }).tempRangeF.min).toBe(55);
  });

  it("rejects other fields, seasons, and bad ranges", () => {
    expect(ItemPatch.safeParse({ tempRangeF: { min: 40, max: 70 }, title: "x" }).success).toBe(false);
    expect(ItemPatch.safeParse({ seasons: ["fall"] }).success).toBe(false);
    expect(ItemPatch.safeParse({ tempRangeF: { min: 70, max: 40 } }).success).toBe(false);
    expect(ItemPatch.safeParse({ tempRangeF: { min: 40.5, max: 70 } }).success).toBe(false);
    expect(ItemPatch.safeParse({ tempRangeF: { min: -40, max: 70 } }).success).toBe(false);
  });
});
