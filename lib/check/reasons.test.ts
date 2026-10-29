import { describe, expect, it } from "vitest";
import type { Category } from "../ai/schemas/common";
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
      "Brings back 3 pieces you couldn't wear: Striped tee, Linen pants and Clogs.",
    );
  });

  it("says how many questions had nothing to go on", () => {
    expect(suitsYouReason([{ score: 6 }, { score: 0 }])).toBe("Scored on what you said about your clothes.");
    expect(suitsYouReason([{ score: 6 }, { score: null }, { score: null }])).toBe("Half marks on 2 with nothing to go on.");
    expect(suitsYouReason([{ score: null }])).toBe("Not enough to go on yet.");
  });

  it("explains the occasion gap", () => {
    const school = { occasion: "school" as const, before: 1, after: 2, wanted: 3, tier: "more_outfits" as const, points: 3.3 };
    const home = { occasion: "home" as const, before: 0, after: 1, wanted: 2, tier: "from_zero" as const, points: 5 };
    const sport = { occasion: "sport" as const, before: 4, after: 6, wanted: 1, tier: "already_enough" as const, points: 0 };
    expect(fillsGapReason("from_zero", [home, school, sport], true)).toBe(
      "Home: 2 short, this adds 1. School: 2 short, this adds 1.",
    );
    expect(fillsGapReason("already_enough", [sport], true)).toBe("Adds 2 for sport, but you already have enough.");
    expect(fillsGapReason("none", [], true)).toBe("Doesn't add outfits for any occasion.");
    expect(fillsGapReason("none", [], false)).toBe(NO_LIFESTYLE_REASON);
  });

  it("says which slot is missing", () => {
    const none = (category: Category): MissingSlot => ({ category, owned: false });
    const owned = (category: Category): MissingSlot => ({ category, owned: true });
    expect(gapReason([[none("top"), none("bottom")], [none("one_piece")]], "nothing_owned", "shoes")).toBe(
      "Nothing in your closet to wear these with yet. Add a top and bottom, or a one-piece.",
    );
    expect(gapReason([[none("shoes")]], "nothing_owned", "bottom")).toBe(
      "Nothing in your closet to wear this with yet. Add shoes.",
    );
    // A jacket with only a one-piece in the closet: missingSlots keeps just the shoes.
    expect(gapReason([[none("shoes")]], "nothing_owned", "outerwear")).toBe(
      "Nothing in your closet to wear this with yet. Add shoes.",
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
