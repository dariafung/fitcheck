import { describe, expect, it } from "vitest";
import { categoryLabel, itemTags, tagGroups } from "./tags";

const AI_TAGS = {
  category: "top",
  colors: [{ name: "white" }],
  materials: ["cotton"],
  fit: "regular",
  formality: 3,
  seasons: ["spring", "summer"],
  occasions: ["work"],
};

describe("itemTags", () => {
  it("lets user corrections win field by field", () => {
    const tags = itemTags({
      category: "top",
      ai_tags: AI_TAGS,
      user_tags: { fit: "relaxed", occasions: ["social"] },
    });
    expect(tags).toMatchObject({ fit: "relaxed", occasions: ["social"], materials: ["cotton"] });
  });

  it("falls back to the category when AI tags are missing", () => {
    expect(itemTags({ category: "shoes", ai_tags: null, user_tags: {} })).toMatchObject({
      category: "shoes",
      colors: [],
      materials: [],
      formality: 3,
      occasions: [],
    });
  });

  it("ignores user tags that do not fit the schema", () => {
    const tags = itemTags({ category: "top", ai_tags: AI_TAGS, user_tags: { fit: "baggy" } });
    expect(tags.fit).toBe("regular");
  });

  it("drops an invalid color family or temperature range but keeps the rest", () => {
    const tags = itemTags({
      category: "top",
      ai_tags: { ...AI_TAGS, colorFamily: "rainbow", tempRangeF: { min: 50, max: 80 } },
      user_tags: { fit: "relaxed", tempRangeF: { min: 90, max: 10 } },
    });
    expect(tags).toMatchObject({ fit: "relaxed", materials: ["cotton"], tempRangeF: { min: 50, max: 80 } });
    expect(tags.colorFamily).toBeUndefined();
  });
});

describe("tagGroups", () => {
  it("labels values and drops empty groups", () => {
    const groups = tagGroups(itemTags({ category: "top", ai_tags: AI_TAGS, user_tags: {} }));
    expect(groups).toEqual([
      { label: "Color", values: ["White"] },
      { label: "Material", values: ["Cotton"] },
      { label: "Fit", values: ["Regular"] },
      { label: "Vibe", values: ["Smart casual"] },
      { label: "For", values: ["Work"] },
    ]);
  });
});

describe("categoryLabel", () => {
  it("reads like a word", () => {
    expect(categoryLabel("one_piece")).toBe("One-piece");
    expect(categoryLabel("mystery")).toBe("mystery");
  });
});
