import { describe, expect, it } from "vitest";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { itemUpdate, needsListing, needsSize, type EditableRow } from "./item-update";
import { itemTags } from "./tags";

const AI: ItemTags = {
  category: "top",
  colors: [{ name: "white", hex: "#ffffff" }],
  colorFamily: "white",
  materials: ["cotton"],
  fit: "regular",
  formality: 3,
  tempRangeF: { min: 55, max: 85 },
  occasions: ["work"],
};

function row(over: Partial<EditableRow> = {}): EditableRow {
  return {
    title: "White shirt",
    brand: "Uniqlo",
    category: "top",
    status: "active",
    size: null,
    asking_price_cents: null,
    condition: null,
    ai_tags: AI,
    user_tags: {},
    ...over,
  };
}

// The card sends the tags as the page shows them, with the user's changes.
function edit(r: EditableRow, tags: Partial<ItemTags>, over: { title?: string; brand?: string | null } = {}) {
  return {
    details: {
      title: over.title ?? r.title,
      brand: over.brand === undefined ? r.brand : over.brand,
      tags: { ...itemTags(r), ...tags },
    },
  };
}

describe("itemUpdate", () => {
  it("is null when nothing changes", () => {
    expect(itemUpdate(row(), edit(row(), {}))).toBeNull();
    expect(itemUpdate(row({ user_tags: { fit: "slim" } }), edit(row({ user_tags: { fit: "slim" } }), {}))).toBeNull();
    expect(itemUpdate(row(), { status: "active" })).toBeNull();
  });

  it("changes the status alone", () => {
    expect(itemUpdate(row(), { status: "passing_on" })).toEqual({ status: "passing_on" });
    expect(itemUpdate(row({ status: "passing_on" }), { status: "active" })).toEqual({ status: "active" });
  });

  it("stores changed tags as user corrections and leaves the AI's alone", () => {
    const r = row({ user_tags: { fit: "slim" } });
    const update = itemUpdate(r, edit(r, { formality: 4, occasions: ["work", "social"], tempRangeF: { min: 40, max: 70 } }));
    expect(update).toEqual({
      user_tags: { fit: "slim", formality: 4, occasions: ["work", "social"], tempRangeF: { min: 40, max: 70 } },
    });
  });

  it("drops a correction set back to the AI's value", () => {
    const r = row({ user_tags: { fit: "slim", formality: 4 } });
    expect(itemUpdate(r, edit(r, { fit: "regular" }))).toEqual({ user_tags: { formality: 4 } });
  });

  it("writes name, brand and category to their columns", () => {
    const update = itemUpdate(row(), edit(row(), { category: "outerwear" }, { title: "Overshirt", brand: null }));
    expect(update).toEqual({
      title: "Overshirt",
      brand: null,
      category: "outerwear",
      user_tags: { category: "outerwear" },
    });
  });

  it("works for items without AI tags", () => {
    const r = row({ ai_tags: null, category: "shoes" });
    const update = itemUpdate(r, edit(r, { colors: [{ name: "black" }], formality: 2 }));
    expect(update).toEqual({ user_tags: { colors: [{ name: "black" }], formality: 2 } });
  });

  it("applies details and status together", () => {
    expect(itemUpdate(row(), { ...edit(row(), { fit: "relaxed" }), status: "passing_on" })).toEqual({
      status: "passing_on",
      user_tags: { fit: "relaxed" },
    });
  });

  it("sets and clears the size, and leaves it alone when unchanged", () => {
    expect(itemUpdate(row(), { size: "M" })).toEqual({ size: "M" });
    expect(itemUpdate(row({ size: "M" }), { size: "M" })).toBeNull();
    expect(itemUpdate(row({ size: "M" }), { size: null })).toEqual({ size: null });
    expect(itemUpdate(row(), { status: "passing_on", size: "US 8" })).toEqual({ status: "passing_on", size: "US 8" });
  });
});

describe("needsSize", () => {
  it("asks for a size when passing on an item that has none", () => {
    expect(needsSize(row(), { status: "passing_on" })).toBe(true);
    expect(needsSize(row(), { status: "passing_on", size: "M" })).toBe(false);
    expect(needsSize(row({ size: "M" }), { status: "passing_on" })).toBe(false);
  });

  it("won't take the size off an item that is passing on", () => {
    expect(needsSize(row({ status: "passing_on", size: "M" }), { size: null })).toBe(true);
    expect(needsSize(row({ status: "passing_on", size: "M" }), { size: "L" })).toBe(false);
    // Kept again, the size may go.
    expect(needsSize(row({ status: "passing_on", size: "M" }), { status: "active", size: null })).toBe(false);
    expect(needsSize(row({ size: "M" }), { size: null })).toBe(false);
  });

  it("lets items passed on before sizes existed be edited or kept", () => {
    const old = row({ status: "passing_on" });
    expect(needsSize(old, edit(old, { formality: 4 }))).toBe(false);
    expect(needsSize(old, { status: "passing_on" })).toBe(false);
    expect(needsSize(old, { status: "active" })).toBe(false);
  });
});

describe("needsListing", () => {
  const listed = { askingPriceCents: 1200, condition: "like_new" as const };

  it("asks for a price and a condition when passing an item on", () => {
    expect(needsListing(row(), { status: "passing_on", size: "M" })).toBe(true);
    expect(needsListing(row(), { status: "passing_on", size: "M", askingPriceCents: 1200 })).toBe(true);
    expect(needsListing(row(), { status: "passing_on", size: "M", ...listed })).toBe(false);
    expect(needsListing(row({ asking_price_cents: 1200, condition: "good" }), { status: "passing_on" })).toBe(false);
  });

  it("won't take either off an item that is passing on, but lets it change", () => {
    const passing = row({ status: "passing_on", size: "M", asking_price_cents: 1200, condition: "good" });
    expect(needsListing(passing, { askingPriceCents: null })).toBe(true);
    expect(needsListing(passing, { condition: null })).toBe(true);
    expect(needsListing(passing, { askingPriceCents: 900, condition: "fair" })).toBe(false);
    expect(needsListing(passing, { status: "active", askingPriceCents: null })).toBe(false);
  });

  it("lets items passed on before listings existed be edited or kept", () => {
    const old = row({ status: "passing_on", size: "M" });
    expect(needsListing(old, { size: "L" })).toBe(false);
    expect(needsListing(old, { status: "active" })).toBe(false);
  });

  it("writes only the listing fields that change", () => {
    const passing = row({ status: "passing_on", size: "M", asking_price_cents: 1200, condition: "good" });
    expect(itemUpdate(passing, { askingPriceCents: 1200, condition: "good" })).toBeNull();
    expect(itemUpdate(passing, { askingPriceCents: 950, condition: "good" })).toEqual({ asking_price_cents: 950 });
    expect(itemUpdate(row(), { status: "passing_on", size: "M", ...listed })).toEqual({
      status: "passing_on",
      size: "M",
      asking_price_cents: 1200,
      condition: "like_new",
    });
  });
});
