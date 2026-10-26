import { describe, expect, it } from "vitest";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { isOwnImagePath } from "./images";
import { changedTags } from "./tags";

describe("isOwnImagePath", () => {
  const user = "f97fc346-9acc-4404-bc52-9a6ba86a9bce";
  const file = "0b4c2a64-34c9-4f0e-9a43-6cc1f1a0f6d1.webp";

  it("accepts the user's own uploads only", () => {
    expect(isOwnImagePath(`${user}/${file}`, user)).toBe(true);
    expect(isOwnImagePath(`852c8e3d-abf7-4955-ab65-9d83194a02ae/${file}`, user)).toBe(false);
    expect(isOwnImagePath(`${user}/../other/${file}`, user)).toBe(false);
    expect(isOwnImagePath(`${user}/${file.replace(".webp", ".png")}`, user)).toBe(false);
  });
});

describe("changedTags", () => {
  const ai: ItemTags = {
    category: "top",
    colors: [{ name: "Oat" }],
    materials: ["linen"],
    formality: 2,
    tempRangeF: { min: 55, max: 85 },
    occasions: ["social"],
  };

  it("keeps only the fields the user changed", () => {
    const edited: ItemTags = { ...ai, colors: [{ name: "Cream" }], fit: "relaxed", tempRangeF: { min: 50, max: 85 } };
    expect(changedTags(ai, edited)).toEqual({
      colors: [{ name: "Cream" }],
      fit: "relaxed",
      tempRangeF: { min: 50, max: 85 },
    });
  });

  it("is empty when nothing changed", () => {
    expect(changedTags(ai, structuredClone(ai))).toEqual({});
  });
});
