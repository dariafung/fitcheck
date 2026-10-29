import { describe, expect, it } from "vitest";
import type { Category } from "../ai/schemas/common";
import { FIT_QUESTIONS } from "./fit-questions";
import type { MissingSlot } from "./gaps";
import {
  fillsGapReason,
  gapReason,
  NO_LIFESTYLE_REASON,
  outfitsReason,
  revivesReason,
  suitsYouReason,
} from "./reasons";

describe("reasons", () => {
  it("counts outfits and revived pieces", () => {
    expect(outfitsReason(0)).toBe("Doesn't make an outfit with your closet yet.");
    expect(outfitsReason(1)).toBe("Makes 1 outfit with your closet.");
    expect(outfitsReason(4)).toBe("Makes 4 outfits with your closet.");
    expect(revivesReason(["Striped tee", "Linen pants", "Clogs"])).toBe(
      "3 pieces that had no outfit now have one: Striped tee, Linen pants and Clogs.",
    );
    expect(revivesReason(["Clogs"])).toBe("1 piece that had no outfit now has one: Clogs.");
    expect(revivesReason([])).toBe("Doesn't give an outfit to anything that had none.");
  });

  it("names the questions that got the default score", () => {
    expect(suitsYouReason([{ id: "cut_flatters", score: 6 }, { id: "color_liked", score: 0 }])).toBe(
      "Scored on what you said about your clothes.",
    );
    expect(
      suitsYouReason([
        { id: "cut_flatters", score: 6 },
        { id: "color_liked", score: null },
        { id: "feel_liked", score: null },
      ]),
    ).toBe("No notes to compare on color and feel yet, so those get the default 4/8.");
    expect(suitsYouReason([{ id: "cut_flatters", score: 6 }, { id: "spares_trouble_areas", score: null }])).toBe(
      "No notes to compare on the spots you're unsure about yet, so it gets the default 4/8.",
    );
    expect(suitsYouReason([{ id: "cut_flatters", score: null }])).toBe(
      "No notes on your clothes to compare yet, so every question gets the default 4/8.",
    );
  });

  it("names every fit question", () => {
    const reason = suitsYouReason(FIT_QUESTIONS.map((q, i) => ({ id: q.id, score: i === 0 ? 5 : null })));
    // A plain word for each, never the raw id.
    expect(reason).not.toMatch(/_/);
  });

  it("explains the occasion gap", () => {
    const school = { occasion: "school" as const, before: 1, after: 2, wanted: 3, tier: "more_outfits" as const, points: 3.3 };
    const home = { occasion: "home" as const, before: 0, after: 1, wanted: 2, tier: "from_zero" as const, points: 5 };
    const sport = { occasion: "sport" as const, before: 4, after: 6, wanted: 1, tier: "already_enough" as const, points: 0 };
    expect(fillsGapReason("from_zero", [home, school, sport], true)).toBe(
      "You want 2 home outfits and have 0. This adds 1. You want 3 school outfits and have 1. This adds 1.",
    );
    const one = { occasion: "work" as const, before: 0, after: 2, wanted: 1, tier: "from_zero" as const, points: 5 };
    expect(fillsGapReason("from_zero", [one], true)).toBe("You want 1 work outfit and have 0. This adds 2.");
    expect(fillsGapReason("already_enough", [sport], true)).toBe("Adds 2 sport outfits, but you already have enough.");
    expect(fillsGapReason("none", [], true)).toBe("Doesn't add outfits for any occasion.");
    expect(fillsGapReason("none", [], false)).toBe(NO_LIFESTYLE_REASON);
  });

  it("says which slot is missing", () => {
    const none = (category: Category): MissingSlot => ({ category, owned: false });
    const owned = (category: Category): MissingSlot => ({ category, owned: true });
    expect(gapReason([[none("top"), none("bottom")], [none("one_piece")]], "nothing_owned", "shoes")).toBe(
      "Nothing in your closet to wear these with yet. Add a top and bottom, or a one-piece.",
    );
    // Pants with a top that goes with them, and no shoes.
    expect(gapReason([[none("shoes")]], "nothing_owned", "bottom")).toBe(
      "Your tops could go with this, but you have no shoes yet.",
    );
    expect(gapReason([[none("bottom"), none("shoes")]], "nothing_owned", "top")).toBe(
      "Nothing in your closet to wear this with yet. Add a bottom and shoes.",
    );
    // Shoes with bottoms but no tops or one-pieces.
    expect(gapReason([[none("top")], [none("one_piece")]], "nothing_owned", "shoes")).toBe(
      "Your bottoms could go with these, but you have no tops or one-pieces yet.",
    );
    // A jacket with only a one-piece in the closet: missingSlots keeps just the
    // shoes, which can't tell a one-piece from a top and bottom.
    expect(gapReason([[none("shoes")]], "nothing_owned", "outerwear")).toBe(
      "Some of your clothes could go with this, but you have no shoes yet.",
    );
    expect(gapReason([[none("shoes")], [none("shoes")]], "nothing_owned", "outerwear")).toBe(
      "Some of your clothes could go with this, but you have no shoes yet.",
    );
    // A jacket with tops and nothing else.
    expect(
      gapReason([[none("bottom"), none("shoes")], [none("one_piece"), none("shoes")]], "nothing_owned", "outerwear"),
    ).toBe(
      "Your tops could go with this, but you have no bottoms, shoes or one-pieces yet. Add a bottom and shoes, or a one-piece and shoes.",
    );
    expect(
      gapReason([[none("top"), none("bottom"), none("shoes")], [none("one_piece"), none("shoes")]], "nothing_owned", "outerwear"),
    ).toBe("Nothing in your closet to wear this with yet. Add a top, bottom and shoes, or a one-piece and shoes.");
    expect(gapReason([[owned("top")], [none("one_piece")]], "no_match", "shoes")).toBe(
      "Creates a gap: none of your tops go with it, or you have no one-pieces.",
    );
    expect(gapReason([[none("top"), owned("bottom")]], "no_match", "shoes")).toBe(
      "Creates a gap: you have no tops, and none of your bottoms go with it.",
    );
    expect(gapReason([], "no_match", "top")).toBe("Creates a gap: the pieces that go with it don't go together.");
  });
});
