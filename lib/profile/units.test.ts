import { describe, expect, it } from "vitest";
import { displayBounds, feetAndInches, fromDisplay, parseUnits, toDisplay, unitsCookieString } from "./units";

describe("units", () => {
  it("defaults to in / lb", () => {
    expect(parseUnits(null)).toBe("imperial");
    expect(parseUnits("nonsense")).toBe("imperial");
    expect(parseUnits("metric")).toBe("metric");
    expect(unitsCookieString("metric")).toMatch(/^fc_units=metric; Path=\/;/);
  });

  it("shows inches to 0.5 and pounds to 1", () => {
    expect(toDisplay("length", 165, "imperial")).toBe(65);
    expect(toDisplay("length", 86, "imperial")).toBe(34);
    expect(toDisplay("length", 87.5, "imperial")).toBe(34.5);
    expect(toDisplay("weight", 58, "imperial")).toBe(128);
  });

  it("shows cm / kg to 0.1", () => {
    expect(toDisplay("length", 165.14, "metric")).toBe(165.1);
    expect(toDisplay("weight", 58, "metric")).toBe(58);
  });

  it("converts typed values back to cm / kg", () => {
    expect(fromDisplay("length", 65, "imperial")).toBeCloseTo(165.1, 1);
    expect(fromDisplay("weight", 128, "imperial")).toBeCloseTo(58.06, 2);
    expect(fromDisplay("length", 170, "metric")).toBe(170);
  });

  it("rounds shown bounds inward so they convert back inside the range", () => {
    for (const units of ["imperial", "metric"] as const) {
      for (const kind of ["length", "weight"] as const) {
        const range = { min: 25, max: 230 };
        const shown = displayBounds(kind, range, units);
        expect(fromDisplay(kind, shown.min, units)).toBeGreaterThanOrEqual(range.min);
        expect(fromDisplay(kind, shown.max, units)).toBeLessThanOrEqual(range.max);
      }
    }
    expect(displayBounds("length", { min: 100, max: 230 }, "imperial")).toEqual({ min: 39.5, max: 90.5 });
    expect(displayBounds("weight", { min: 25, max: 250 }, "imperial")).toEqual({ min: 56, max: 551 });
    expect(displayBounds("length", { min: 100, max: 230 }, "metric")).toEqual({ min: 100, max: 230 });
  });

  it("writes height as feet and inches", () => {
    expect(feetAndInches(65)).toBe("5 ft 5 in");
    expect(feetAndInches(71.5)).toBe("6 ft 0 in");
  });
});
