import { describe, expect, it } from "vitest";
import { MAX_OUTFITS_WANTED } from "../ai/schemas/common";
import { MEASUREMENT_LIMITS, ProfileInput } from "./profile";

const VALID = {
  name: "figment",
  heightCm: 165,
  weightKg: 58,
  bustCm: 86,
  waistCm: null,
  hipCm: 94,
  inseamCm: null,
  bodyShape: "pear",
  lifestyleMix: { work: 0, school: 3, social: 2, sport: 3, home: 3 },
  topSize: "M",
  bottomSize: "M",
  shoeSize: "W7.5",
  tempUnit: "C",
  resaleOptIn: false,
};

const parses = (over: Record<string, unknown>) => ProfileInput.safeParse({ ...VALID, ...over }).success;

describe("ProfileInput", () => {
  it("requires a name of 2 to 30 characters", () => {
    expect(parses({ name: undefined })).toBe(false);
    expect(parses({ name: "x" })).toBe(false);
    expect(parses({ name: "x".repeat(31) })).toBe(false);
    expect(ProfileInput.parse({ ...VALID, name: " Jo " }).name).toBe("Jo");
  });

  it("accepts a full profile with optional measurements left empty", () => {
    expect(ProfileInput.parse(VALID)).toEqual(VALID);
  });

  it("requires height, weight and a body shape", () => {
    expect(parses({ heightCm: null })).toBe(false);
    expect(parses({ weightKg: undefined })).toBe(false);
    expect(parses({ bodyShape: null })).toBe(false);
    expect(parses({ bodyShape: "triangle" })).toBe(false);
  });

  it("requires the three sizes from their lists, and the resale choice", () => {
    expect(parses({ topSize: null })).toBe(false);
    expect(parses({ bottomSize: "XXXL" })).toBe(false);
    expect(parses({ shoeSize: undefined })).toBe(false);
    expect(parses({ shoeSize: "7.5" })).toBe(false);
    expect(parses({ shoeSize: "M15" })).toBe(true);
    expect(parses({ resaleOptIn: "yes" })).toBe(false);
  });

  it("requires a temperature unit, F or C", () => {
    expect(parses({ tempUnit: undefined })).toBe(false);
    expect(parses({ tempUnit: null })).toBe(false);
    expect(parses({ tempUnit: "K" })).toBe(false);
    expect(parses({ tempUnit: "F" })).toBe(true);
  });

  it("keeps measurements within sane bounds", () => {
    expect(parses({ heightCm: MEASUREMENT_LIMITS.heightCm.max })).toBe(true);
    expect(parses({ heightCm: MEASUREMENT_LIMITS.heightCm.max + 1 })).toBe(false);
    expect(parses({ waistCm: MEASUREMENT_LIMITS.waistCm.min - 1 })).toBe(false);
    expect(parses({ weightKg: -1 })).toBe(false);
  });

  it("wants whole outfit counts from 0 to the max", () => {
    const mix = (over: Record<string, unknown>) => ({ lifestyleMix: { ...VALID.lifestyleMix, ...over } });
    expect(parses(mix({ work: MAX_OUTFITS_WANTED }))).toBe(true);
    expect(parses(mix({ work: MAX_OUTFITS_WANTED + 1 }))).toBe(false);
    expect(parses(mix({ work: 1.5 }))).toBe(false);
    expect(parses(mix({ work: -1 }))).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(parses({ displayName: "x" })).toBe(false);
  });
});
