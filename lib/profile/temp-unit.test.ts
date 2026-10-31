import { describe, expect, it } from "vitest";
import { TEMP_F_MAX, TEMP_F_MIN } from "../temperature";
import { fromUnit, parseTempUnit, tempBounds, toUnit } from "./temp-unit";

describe("temp unit", () => {
  it("defaults to °F", () => {
    expect(parseTempUnit(null)).toBe("F");
    expect(parseTempUnit("K")).toBe("F");
    expect(parseTempUnit("C")).toBe("C");
  });

  it("leaves °F alone", () => {
    expect(toUnit(56, "F")).toBe(56);
    expect(fromUnit(56, "F")).toBe(56);
    expect(tempBounds("F")).toEqual({ min: TEMP_F_MIN, max: TEMP_F_MAX });
  });

  it("shows °C as whole numbers", () => {
    expect(toUnit(50, "C")).toBe(10);
    expect(toUnit(65, "C")).toBe(18);
    expect(toUnit(32, "C")).toBe(0);
    expect(toUnit(-20, "C")).toBe(-29);
  });

  it("brings every allowed °C back to itself, inside the °F bounds", () => {
    const { min, max } = tempBounds("C");
    expect({ min, max }).toEqual({ min: -29, max: 43 });
    for (let c = min; c <= max; c++) {
      const f = fromUnit(c, "C");
      expect(f).toBeGreaterThanOrEqual(TEMP_F_MIN);
      expect(f).toBeLessThanOrEqual(TEMP_F_MAX);
      expect(toUnit(f, "C")).toBe(c);
    }
  });
});
