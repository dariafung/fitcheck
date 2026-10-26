import { describe, expect, it } from "vitest";
import { readTempRange } from "./temp-range";

describe("readTempRange", () => {
  it("reads two whole numbers", () => {
    expect(readTempRange("55", "85")).toEqual({ range: { min: 55, max: 85 } });
    expect(readTempRange("-10", "-10")).toEqual({ range: { min: -10, max: -10 } });
  });

  it("allows both boxes empty", () => {
    expect(readTempRange("", " ")).toEqual({});
  });

  it("says when low is above high", () => {
    expect(readTempRange("90", "60").problem).toBe("Low should be at or below high.");
  });

  it("asks for both numbers when one is empty", () => {
    expect(readTempRange("", "80").problem).toBe("Fill in both numbers.");
  });

  it.each([
    ["55.5", "80"],
    ["-40", "80"],
    ["55", "120"],
  ])("asks for whole numbers in range for %j to %j", (low, high) => {
    expect(readTempRange(low, high).problem).toBe("Use whole numbers from -20 to 110.");
  });
});
