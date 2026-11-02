import { describe, expect, it } from "vitest";
import { verdictFor, VERDICTS } from "./verdict";

describe("verdict", () => {
  it("puts each score in its band, edges included", () => {
    expect(verdictFor(100)).toBe(VERDICTS.worthBuying);
    expect(verdictFor(75)).toBe(VERDICTS.worthBuying);
    expect(verdictFor(74.9)).toBe(VERDICTS.goodAdd);
    expect(verdictFor(60)).toBe(VERDICTS.goodAdd);
    expect(verdictFor(59.9)).toBe(VERDICTS.thinkTwice);
    expect(verdictFor(40)).toBe(VERDICTS.thinkTwice);
    expect(verdictFor(39.9)).toBe(VERDICTS.skip);
    expect(verdictFor(0)).toBe(VERDICTS.skip);
  });

  it("is all caps and at most four words", () => {
    for (const word of Object.values(VERDICTS)) {
      expect(word).toBe(word.toUpperCase());
      expect(word.split(" ").length).toBeLessThanOrEqual(4);
    }
  });
});
