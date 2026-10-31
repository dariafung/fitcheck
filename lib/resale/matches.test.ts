import { describe, expect, it } from "vitest";
import { RESALE_SCORE_THRESHOLD, strongMatches } from "./matches";

describe("strongMatches", () => {
  it("is unchecked when no buyer was checked", () => {
    expect(strongMatches([])).toEqual({ state: "unchecked" });
  });

  it("counts every score at or over the threshold, and nothing else", () => {
    const result = strongMatches([
      { score: RESALE_SCORE_THRESHOLD },
      { score: 59.5 },
      { score: 84 },
    ]);
    expect(result).toEqual({ state: "matches", count: 2, someUnchecked: false });
  });

  it("says no one is a strong match when every score is under it", () => {
    expect(strongMatches([{ score: 41 }])).toEqual({ state: "none_strong", someUnchecked: false });
  });

  it("says when some buyers weren't checked yet", () => {
    expect(strongMatches([{ score: 41 }], true)).toEqual({ state: "none_strong", someUnchecked: true });
    expect(strongMatches([{ score: 70 }], true)).toMatchObject({ someUnchecked: true });
  });
});
