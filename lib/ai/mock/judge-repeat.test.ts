import { describe, expect, it } from "vitest";
import type { ItemSummary, ItemTags } from "../schemas/common";
import { mockJudgeRepeat } from "./judge-repeat";

let next = 0;
function item(tags: Partial<ItemTags> & Pick<ItemTags, "category">): ItemSummary {
  next += 1;
  const id = `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
  return { id, title: `${tags.category} ${next}`, tags: { colors: [], materials: [], formality: 3, occasions: [], ...tags } };
}
const score = (candidate: ItemSummary, ...closet: ItemSummary[]) => mockJudgeRepeat({ candidate, closet }).score;

describe("mockJudgeRepeat", () => {
  it("1: same category, color family and fit", () => {
    const owned = item({ category: "top", colorFamily: "white", fit: "regular", subcategory: "T-shirt" });
    expect(score(item({ category: "top", colorFamily: "white", fit: "regular", subcategory: "t shirt" }), owned)).toBe(1);
    expect(score(item({ category: "top", colorFamily: "white", fit: "regular" }), owned)).toBe(1);
  });

  it("4: same category and color family only", () => {
    const owned = item({ category: "top", colorFamily: "white", fit: "regular", subcategory: "t-shirt" });
    expect(score(item({ category: "top", colorFamily: "white", fit: "slim" }), owned)).toBe(4);
    expect(score(item({ category: "top", colorFamily: "white", fit: "regular", subcategory: "blouse" }), owned)).toBe(4);
    expect(score(item({ category: "top", colorFamily: "white" }), owned)).toBe(4);
  });

  it("10: other category or color, or no color family", () => {
    const owned = item({ category: "top", colorFamily: "white", fit: "regular" });
    expect(score(item({ category: "bottom", colorFamily: "white", fit: "regular" }), owned)).toBe(10);
    expect(score(item({ category: "top", colorFamily: "black", fit: "regular" }), owned)).toBe(10);
    expect(score(item({ category: "top", fit: "regular" }), item({ category: "top", fit: "regular" }))).toBe(10);
  });

  it("names the closest owned item, or none", () => {
    const similar = item({ category: "top", colorFamily: "white" });
    const same = item({ category: "top", colorFamily: "white", fit: "slim" });
    const candidate = item({ category: "top", colorFamily: "white", fit: "slim" });
    expect(mockJudgeRepeat({ candidate, closet: [similar, same] })).toMatchObject({ score: 1, closestId: same.id });
    expect(mockJudgeRepeat({ candidate: item({ category: "shoes", colorFamily: "white" }), closet: [similar] })).toMatchObject({
      score: 10,
      closestId: null,
    });
  });
});
