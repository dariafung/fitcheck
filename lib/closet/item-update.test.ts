import { describe, expect, it } from "vitest";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { itemUpdate, type EditableRow } from "./item-update";
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
});
