import { describe, expect, it } from "vitest";
import { FIT_QUESTIONS } from "./fit-questions";
import {
  DUPLICATE_POINTS,
  MAX_POINTS,
  NO_DATA_POINTS,
  OCCASION_GAP_POINTS,
  OUTFIT_TIERS,
  POINTS_PER_YES,
  REVIVE_TIERS,
  tierPoints,
} from "./score";

describe("score tiers", () => {
  it("adds up to 100", () => {
    expect(Object.values(MAX_POINTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(FIT_QUESTIONS.length * POINTS_PER_YES).toBe(MAX_POINTS.suitsYou);
    expect(NO_DATA_POINTS).toBe(4);
  });

  it("outfits: 0 / 1–2 / 3–5 / 6+ → 0 / 8 / 15 / 20", () => {
    expect([0, 1, 2, 3, 5, 6, 40].map((n) => tierPoints(n, OUTFIT_TIERS))).toEqual([0, 8, 8, 15, 15, 20, 20]);
  });

  it("revives: 0 / 1 / 2–3 / 4+ → 0 / 5 / 10 / 15", () => {
    expect([0, 1, 2, 3, 4, 9].map((n) => tierPoints(n, REVIVE_TIERS))).toEqual([0, 5, 10, 10, 15, 15]);
  });

  it("gap and repeat tiers top out at their max", () => {
    expect(Math.max(...Object.values(OCCASION_GAP_POINTS))).toBe(MAX_POINTS.fillsGap);
    expect(Math.max(...Object.values(DUPLICATE_POINTS))).toBe(MAX_POINTS.notRepeat);
  });
});
