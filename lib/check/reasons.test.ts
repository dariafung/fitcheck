import { describe, expect, it } from "vitest";
import {
  fillsGapReason,
  gapReason,
  NO_LIFESTYLE_REASON,
  notRepeatReason,
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

  it("counts yes answers, leaving out unasked ones", () => {
    expect(suitsYouReason([{ answer: true }, { answer: false }, { answer: null }])).toBe("Yes to 1 of 2.");
    expect(suitsYouReason([{ answer: null }])).toBe("Not enough to go on yet.");
  });

  it("explains the occasion gap", () => {
    const school = { occasion: "school" as const, before: 1, after: 2, wanted: 3, tier: "more_outfits" as const };
    const home = { occasion: "home" as const, before: 0, after: 1, wanted: 2, tier: "from_zero" as const };
    const sport = { occasion: "sport" as const, before: 4, after: 6, wanted: 1, tier: "already_enough" as const };
    expect(fillsGapReason("from_zero", [home, school, sport], true)).toBe(
      "Home: 2 short, this adds 1. School: 2 short, this adds 1.",
    );
    expect(fillsGapReason("already_enough", [sport], true)).toBe("Adds 2 for sport, but you already have enough.");
    expect(fillsGapReason("none", [], true)).toBe("Doesn't add outfits for any occasion.");
    expect(fillsGapReason("none", [], false)).toBe(NO_LIFESTYLE_REASON);
  });

  it("names the duplicate", () => {
    expect(notRepeatReason("similar", "Black flats")).toBe("A lot like your Black flats.");
  });

  it("says which slot is missing", () => {
    expect(gapReason([{ category: "shoes", owned: false }])).toBe("Creates a gap: you have no shoes.");
    expect(
      gapReason([
        { category: "top", owned: false },
        { category: "bottom", owned: true },
      ]),
    ).toBe("Creates a gap: you have no tops, and none of your bottoms go with it.");
    expect(gapReason([])).toBe("Creates a gap: the pieces that go with it don't go together.");
  });
});
