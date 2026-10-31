import { describe, expect, it } from "vitest";
import {
  categoryFilters,
  closetCategory,
  closetHref,
  closetTab,
  closetView,
  inCategory,
  inTab,
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
    expect(closetView({ tab: "passing-on", cat: "shoes" })).toEqual({ tab: "passing-on", cat: "shoes" });
    expect(closetView({})).toEqual({ tab: "wearing", cat: null });
  });

  it("leaves the defaults out of the URL", () => {
    expect(closetHref({ tab: "wearing", cat: null })).toBe("/closet");
    expect(closetHref({ tab: "passing-on", cat: null })).toBe("/closet?tab=passing-on");
    expect(closetHref({ tab: "wearing", cat: "bottom" })).toBe("/closet?cat=bottom");
    expect(closetHref({ tab: "passing-on", cat: "one_piece" })).toBe("/closet?tab=passing-on&cat=one-piece");
  });

  it("round-trips through the URL", () => {
    for (const view of [
      { tab: "wearing", cat: null },
      { tab: "passing-on", cat: "outerwear" },
      { tab: "wearing", cat: "one_piece" },
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
