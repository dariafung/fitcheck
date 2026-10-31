import { describe, expect, it } from "vitest";
import { aiTags, categoryLabel, itemTags, tagGroups } from "./tags";

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
  it("keeps the AI's color family and range when the user changed other fields", () => {
    const tags = itemTags({
      category: "top",
      ai_tags: { ...AI_TAGS, colorFamily: "white", tempRangeF: { min: 55, max: 85 } },
      user_tags: { fit: "relaxed" },
    });
    expect(tags).toMatchObject({ fit: "relaxed", colorFamily: "white", tempRangeF: { min: 55, max: 85 } });
    expect(itemTags({ category: "top", ai_tags: { ...AI_TAGS, colorFamily: "white" }, user_tags: {} }).colorFamily).toBe("white");
  });
});

describe("tagGroups", () => {
  it("names fields like the entry card and drops empty groups", () => {
    const groups = tagGroups(itemTags({ category: "top", ai_tags: AI_TAGS, user_tags: {} }));
    expect(groups).toEqual([
      { label: "Type", values: ["Top"] },
      { label: "Fit", values: ["Regular"] },
      { label: "Colors", values: ["White"] },
      { label: "Materials", values: ["Cotton"] },
      { label: "How dressy", values: ["Smart casual"] },
      { label: "Comfortable in", values: ["Any weather"] },
      { label: "Good for", values: ["Work"] },
    ]);
  });

  it("shows the main color, the range, the finer type and user corrections", () => {
    const groups = tagGroups(
      itemTags({
        category: "top",
        ai_tags: { ...AI_TAGS, subcategory: "button-down", colorFamily: "white", tempRangeF: { min: 55, max: 85 } },
        user_tags: { formality: 1, colorFamily: "cream", occasions: ["home", "social"] },
      }),
    );
    const byLabel = Object.fromEntries(groups.map((g) => [g.label, g.values]));
    expect(byLabel).toMatchObject({
      Type: ["Top · Button-down"],
      "Main color": ["Cream"],
      "How dressy": ["Lounge"],
      "Comfortable in": ["55 to 85°F"],
      "Good for": ["Home", "Social"],
    });
  });

  it("shows the range in °C for a profile set to °C", () => {
    const tags = itemTags({ category: "top", ai_tags: { ...AI_TAGS, tempRangeF: { min: 55, max: 85 } }, user_tags: {} });
    const range = tagGroups(tags, "C").find((g) => g.label === "Comfortable in");
    expect(range?.values).toEqual(["13 to 29°C"]);
  });
});

describe("aiTags", () => {
  it("is the AI's tags without user corrections, or a plain set from the category", () => {
    expect(aiTags({ category: "top", ai_tags: AI_TAGS })).toMatchObject({ fit: "regular", occasions: ["work"] });
    expect(aiTags({ category: "shoes", ai_tags: null })).toMatchObject({ category: "shoes", formality: 3 });
  });
});

describe("categoryLabel", () => {
  it("reads like a word", () => {
    expect(categoryLabel("one_piece")).toBe("One-piece");
    expect(categoryLabel("mystery")).toBe("mystery");
  });
});
