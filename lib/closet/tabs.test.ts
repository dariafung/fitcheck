import { describe, expect, it } from "vitest";
import {
  categoryFilters,
  closetCategory,
  closetHref,
  closetTab,
  closetView,
  closetTag,
  inCategory,
  inTab,
  inTag,
  quickTags,
  tagLabel,
} from "./tabs";

describe("closetTab", () => {
  it("reads the tab param and falls back to Wearing", () => {
    expect(closetTab("passing-on")).toBe("passing-on");
    expect(closetTab("wearing")).toBe("wearing");
    expect(closetTab(undefined)).toBe("wearing");
    expect(closetTab("all")).toBe("wearing");
    expect(closetTab("nope")).toBe("wearing");
    expect(closetTab(["passing-on", "wearing"])).toBe("wearing");
  });
});

describe("closetCategory", () => {
  it("reads the category slug and ignores anything else", () => {
    expect(closetCategory("bottom")).toBe("bottom");
    expect(closetCategory("one-piece")).toBe("one_piece");
    expect(closetCategory("one_piece")).toBeNull();
    expect(closetCategory("Bottom")).toBeNull();
    expect(closetCategory("hats")).toBeNull();
    // Accessories can't be added, so there is no filter for them.
    expect(closetCategory("accessory")).toBeNull();
    expect(closetCategory(undefined)).toBeNull();
    expect(closetCategory(["bottom", "top"])).toBeNull();
  });
});

describe("closetView / closetHref", () => {
  it("reads both params together", () => {
    expect(closetView({ tab: "passing-on", cat: "shoes" })).toEqual({ tab: "passing-on", cat: "shoes", tag: null });
    expect(closetView({})).toEqual({ tab: "wearing", cat: null, tag: null });
    expect(closetView({ cat: "top", tag: "not-worn" })).toEqual({ tab: "wearing", cat: "top", tag: "not-worn" });
    // Quick filters are for Wearing only.
    expect(closetView({ tab: "passing-on", tag: "school" })).toEqual({ tab: "passing-on", cat: null, tag: null });
  });

  it("leaves the defaults out of the URL", () => {
    expect(closetHref({ tab: "wearing", cat: null, tag: null })).toBe("/closet");
    expect(closetHref({ tab: "passing-on", cat: null, tag: null })).toBe("/closet?tab=passing-on");
    expect(closetHref({ tab: "wearing", cat: "bottom", tag: null })).toBe("/closet?cat=bottom");
    expect(closetHref({ tab: "passing-on", cat: "one_piece", tag: null })).toBe("/closet?tab=passing-on&cat=one-piece");
    expect(closetHref({ tab: "wearing", cat: "top", tag: "not-worn" })).toBe("/closet?cat=top&tag=not-worn");
    expect(closetHref({ tab: "passing-on", cat: null, tag: "school" })).toBe("/closet?tab=passing-on");
  });

  it("round-trips through the URL", () => {
    for (const view of [
      { tab: "wearing", cat: null, tag: null },
      { tab: "passing-on", cat: "outerwear", tag: null },
      { tab: "wearing", cat: "one_piece", tag: "sport" },
      { tab: "wearing", cat: null, tag: "not-worn" },
    ] as const) {
      const params = Object.fromEntries(new URL(closetHref(view), "http://x").searchParams);
      expect(closetView(params)).toEqual(view);
    }
  });
});

describe("inTab", () => {
  const items = [
    { id: "tee", status: "active" },
    { id: "shorts", status: "passing_on" },
    { id: "jeans", status: "active" },
  ];

  it("splits by status and keeps order", () => {
    expect(inTab(items, "wearing").map((i) => i.id)).toEqual(["tee", "jeans"]);
    expect(inTab(items, "passing-on").map((i) => i.id)).toEqual(["shorts"]);
  });
});

describe("inCategory / categoryFilters", () => {
  const items = [
    { id: "tee", category: "top" },
    { id: "jeans", category: "bottom" },
    { id: "shirt", category: "top" },
    { id: "boots", category: "shoes" },
    { id: "odd", category: "cape" },
  ];

  it("filters by category and keeps order; no category keeps everything", () => {
    expect(inCategory(items, "top").map((i) => i.id)).toEqual(["tee", "shirt"]);
    expect(inCategory(items, "outerwear")).toEqual([]);
    expect(inCategory(items, null)).toBe(items);
  });

  it("offers only the categories that have something, head to toe, with counts", () => {
    expect(categoryFilters(items, null)).toEqual([
      { cat: "top", count: 2 },
      { cat: "bottom", count: 1 },
      { cat: "shoes", count: 1 },
    ]);
  });

  it("never offers accessories", () => {
    expect(categoryFilters([...items, { id: "hoops", category: "accessory" }], null).map((f) => f.cat)).not.toContain(
      "accessory",
    );
  });

  it("keeps the picked category even when it is empty", () => {
    expect(categoryFilters(items, "outerwear")).toEqual([
      { cat: "top", count: 2 },
      { cat: "bottom", count: 1 },
      { cat: "outerwear", count: 0 },
      { cat: "shoes", count: 1 },
    ]);
    expect(categoryFilters([], "shoes")).toEqual([{ cat: "shoes", count: 0 }]);
  });
});

describe("quick filters", () => {
  const piece = (id: string, category: string, occasions: string[]) => ({ id, category, status: "active", occasions });
  const items = [
    piece("a", "top", ["school", "social"]),
    piece("b", "top", ["school"]),
    piece("c", "bottom", ["sport"]),
    piece("d", "shoes", ["school", "sport"]),
    piece("e", "bottom", ["home"]),
  ];
  const notWorn = new Set(["c", "e"]);

  it("reads the tag param", () => {
    expect(closetTag("not-worn")).toBe("not-worn");
    expect(closetTag("work")).toBe("work");
    expect(closetTag("Work")).toBeNull();
    expect(closetTag(["work"])).toBeNull();
    expect(closetTag(undefined)).toBeNull();
  });

  it("filters by not worn lately or by occasion", () => {
    expect(inTag(items, "not-worn", notWorn).map((i) => i.id)).toEqual(["c", "e"]);
    expect(inTag(items, "sport", notWorn).map((i) => i.id)).toEqual(["c", "d"]);
    expect(inTag(items, null, notWorn)).toEqual(items);
    // No calendar, no "not worn" filter.
    expect(inTag(items, "not-worn", null)).toEqual(items);
    expect(tagLabel("not-worn")).toBe("Not worn lately");
    expect(tagLabel("school")).toBe("School");
  });

  it("offers not worn lately, then the two occasions most pieces have, counted with the category", () => {
    expect(quickTags(items, { cat: null, tag: null }, notWorn)).toEqual([
      { tag: "not-worn", count: 2 },
      { tag: "school", count: 3 },
      { tag: "sport", count: 2 },
    ]);
    // Within Tops nothing is unworn or for sport: those drop out.
    expect(quickTags(items, { cat: "top", tag: null }, notWorn)).toEqual([{ tag: "school", count: 2 }]);
    // Without a calendar only occasions.
    expect(quickTags(items, { cat: null, tag: null }, null).map((t) => t.tag)).toEqual(["school", "sport"]);
  });

  it("skips an occasion every piece has and keeps one picked from the URL", () => {
    const allSchool = items.slice(0, 2);
    expect(quickTags(allSchool, { cat: null, tag: null }, null)).toEqual([{ tag: "social", count: 1 }]);
    expect(quickTags(items, { cat: null, tag: "work" }, null)).toEqual([
      { tag: "school", count: 3 },
      { tag: "sport", count: 2 },
      { tag: "work", count: 0 },
    ]);
  });
});
