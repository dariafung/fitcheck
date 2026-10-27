import { describe, expect, it } from "vitest";
import { FIT_QUESTIONS } from "./fit-questions";
import {
  countPoints,
  DUPLICATE_POINTS,
  GAP_POINTS_PER_OUTFIT,
  MAX_POINTS,
  NO_DATA_POINTS,
  occasionPoints,
  POINTS_PER_OUTFIT,
  POINTS_PER_YES,
  POINTS_PER_REVIVED,
  roundPart,
} from "./score";

describe("score parts", () => {
  it("adds up to 100", () => {
    expect(Object.values(MAX_POINTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(FIT_QUESTIONS.length * POINTS_PER_YES).toBe(MAX_POINTS.suitsYou);
    expect(NO_DATA_POINTS).toBe(4);
  });

  it("outfits: 2.5 each, full at 8", () => {
    const points = (n: number) => countPoints(n, POINTS_PER_OUTFIT, MAX_POINTS.outfits);
    expect([0, 1, 3, 7, 8, 40].map(points)).toEqual([0, 2.5, 7.5, 17.5, 20, 20]);
  });

  it("revives: 4 each, capped at 15", () => {
    const points = (n: number) => countPoints(n, POINTS_PER_REVIVED, MAX_POINTS.revives);
    expect([0, 1, 3, 4, 9].map(points)).toEqual([0, 4, 12, 15, 15]);
  });

  it("fills a gap: 5 per outfit added, times how short the occasion was", () => {
    // [wanted, before, added] → points
    const cases = [
      [3, 0, 1, 5],
      [3, 2, 1, 1.7],
      [30, 2, 1, 4.7],
      [30, 2, 3, 14],
      [3, 3, 1, 0],
    ];
    for (const [wanted, before, added, points] of cases) {
      expect(roundPart(occasionPoints(before, before + added, wanted))).toBe(points);
    }
    expect(GAP_POINTS_PER_OUTFIT).toBe(5);
    // Outfits past the shortfall earn nothing more.
    expect(occasionPoints(1, 9, 3)).toBe(occasionPoints(1, 3, 3));
    // Nothing added, or nothing wanted.
    expect(occasionPoints(2, 2, 4)).toBe(0);
    expect(occasionPoints(0, 2, 0)).toBe(0);
  });

  it("repeat tiers top out at the part's max", () => {
    expect(Math.max(...Object.values(DUPLICATE_POINTS))).toBe(MAX_POINTS.notRepeat);
  });

  it("keeps one decimal per part", () => {
    expect(roundPart(15 * (2 / 3))).toBe(10);
    expect(roundPart(15 / 7)).toBe(2.1);
  });
});
