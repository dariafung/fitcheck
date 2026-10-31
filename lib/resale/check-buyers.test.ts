import { describe, expect, it } from "vitest";
import type { BuyCheckResult } from "@/lib/check/buy-check";
import { checkOrder, highlights } from "./check-buyers";
import type { BuyerState } from "./fingerprint";

function part(points: number, max: number) {
  return { points, max, reason: "" };
}

describe("highlights", () => {
  it("names the two parts that scored best for their size, none at 0", () => {
    const parts = {
      suitsYou: part(20, 40),
      outfits: part(10, 20),
      revives: part(15, 15),
      fillsGap: part(0, 15),
      notRepeat: part(9, 10),
    } as unknown as BuyCheckResult["parts"];
    expect(highlights(parts)).toEqual(["revives", "notRepeat"]);
  });
});

function buyer(id: string, school: number | null, createdAt: string): BuyerState {
  return {
    id,
    createdAt,
    lifestyleMix: school === null ? null : { work: 0, school, social: 1, sport: 0, home: 0 },
    profile: { bodyShape: null, heightCm: null },
    items: [],
    feelings: [],
    card: null,
  };
}

describe("checkOrder", () => {
  it("puts who wants the most outfits for the item's occasions first, then who joined first", () => {
    const buyers = [
      buyer("none", null, "2026-01-01"),
      buyer("late", 3, "2026-03-01"),
      buyer("early", 3, "2026-02-01"),
      buyer("most", 8, "2026-04-01"),
    ];
    expect(checkOrder(buyers, ["school"]).map((b) => b.id)).toEqual(["most", "early", "late", "none"]);
    expect(checkOrder(buyers, ["social", "school"]).map((b) => b.id)).toEqual(["most", "early", "late", "none"]);
  });
});
