import { describe, expect, it } from "vitest";
import { RESALE_SCORE_THRESHOLD, strongMatches } from "./matches";

const ITEM = "0b4e7f52-8d1c-4a55-9f0e-2a6c1d3b9e10";

describe("strongMatches", () => {
  it("is unchecked when no buyer was checked", () => {
    expect(strongMatches(ITEM, [])).toEqual({ state: "unchecked" });
  });

  it("lists every score at or over the threshold, best first, without buyer ids", () => {
    const result = strongMatches(ITEM, [
      { buyer_id: "a", score: RESALE_SCORE_THRESHOLD },
      { buyer_id: "b", score: 59.5 },
      { buyer_id: "c", score: 84 },
    ]);
    expect(result.state).toBe("matches");
    if (result.state !== "matches") return;
    expect(result.matches.map((m) => m.score)).toEqual([84, 60]);
    expect(JSON.stringify(result)).not.toMatch(/"(a|b|c)"/);
  });

  it("says no one is a strong match when every score is under it", () => {
    expect(strongMatches(ITEM, [{ buyer_id: "a", score: 41 }])).toEqual({ state: "none_strong", someUnchecked: false });
  });

  it("says when some buyers weren't checked yet", () => {
    expect(strongMatches(ITEM, [{ buyer_id: "a", score: 41 }], true)).toEqual({ state: "none_strong", someUnchecked: true });
    expect(strongMatches(ITEM, [{ buyer_id: "a", score: 70 }], true)).toMatchObject({ someUnchecked: true });
  });
});
