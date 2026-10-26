import { describe, expect, it } from "vitest";
import { fitsToday, groupForToday, itemTempRange } from "./fit-today";

const TODAY = { min: 50, max: 65 };

describe("itemTempRange", () => {
  it("prefers the user's range, then the AI's, and skips invalid ones", () => {
    const ai = { tempRangeF: { min: 30, max: 60 } };
    expect(itemTempRange({ ai_tags: ai, user_tags: { tempRangeF: { min: 55, max: 80 } } })).toEqual({ min: 55, max: 80 });
    expect(itemTempRange({ ai_tags: ai, user_tags: {} })).toEqual({ min: 30, max: 60 });
    expect(itemTempRange({ ai_tags: ai, user_tags: { tempRangeF: { min: 80, max: 55 } } })).toEqual({ min: 30, max: 60 });
    expect(itemTempRange({ ai_tags: null, user_tags: { tempRangeF: "warm" } })).toBeNull();
  });
});

describe("fitsToday", () => {
  it("counts any overlap, edges included, and items without a range", () => {
    expect(fitsToday({ min: 65, max: 90 }, TODAY)).toBe(true);
    expect(fitsToday({ min: 20, max: 50 }, TODAY)).toBe(true);
    expect(fitsToday({ min: 66, max: 90 }, TODAY)).toBe(false);
    expect(fitsToday({ min: -20, max: 49 }, TODAY)).toBe(false);
    expect(fitsToday(null, TODAY)).toBe(true);
  });
});

describe("groupForToday", () => {
  const items = [
    { id: "parka", status: "active", tempRangeF: { min: -20, max: 35 } },
    { id: "tee", status: "active", tempRangeF: { min: 60, max: 95 } },
    { id: "scarf", status: "active", tempRangeF: null },
    { id: "shorts", status: "passing_on", tempRangeF: { min: 60, max: 95 } },
  ];

  it("splits active items by today's temps and puts passing-on items last", () => {
    const groups = groupForToday(items, TODAY);
    expect(groups.good.map((i) => i.id)).toEqual(["tee", "scarf"]);
    expect(groups.notToday.map((i) => i.id)).toEqual(["parka"]);
    expect(groups.passingOn.map((i) => i.id)).toEqual(["shorts"]);
  });

  it("does not split without weather", () => {
    const groups = groupForToday(items, null);
    expect(groups.good.map((i) => i.id)).toEqual(["parka", "tee", "scarf"]);
    expect(groups.notToday).toEqual([]);
  });
});
