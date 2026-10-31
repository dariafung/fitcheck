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

  describe("in °C", () => {
    it("saves typed °C as whole °F", () => {
      expect(readTempRange("10", "18", "C")).toEqual({ range: { min: 50, max: 64 } });
      expect(readTempRange("-29", "43", "C")).toEqual({ range: { min: -20, max: 109 } });
    });

    it("keeps the stored °F for a box left as it was", () => {
      // 51°F shows as 11°C, which alone would save as 52°F.
      const stored = { min: 51, max: 70 };
      expect(readTempRange("11", "21", "C", stored)).toEqual({ range: stored });
      expect(readTempRange("11", "25", "C", stored)).toEqual({ range: { min: 51, max: 77 } });
    });

    it("never saves low above high when both show the same °C", () => {
      // 56°F shows as 13°C; a typed 13°C is 55°F.
      expect(readTempRange("13", "13", "C", { min: 56, max: 70 })).toEqual({ range: { min: 55, max: 55 } });
    });

    it("gives the limits in °C", () => {
      expect(readTempRange("-30", "20", "C").problem).toBe("Use whole numbers from -29 to 43.");
      expect(readTempRange("20", "10", "C").problem).toBe("Low should be at or below high.");
    });
  });
});
