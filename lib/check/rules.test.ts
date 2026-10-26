import { describe, expect, it } from "vitest";
import { makeItem, type FixtureTags } from "./fixtures";
import { checkRules, isComplementary, MAX_FORMALITY_GAP } from "./rules";

const top = (over: Partial<FixtureTags> = {}) =>
  makeItem("f06222fb-82ba-483b-8359-3f0d12337f88", "Top", {
    category: "top", colorFamily: "white", formality: 3,
    tempRangeF: { min: 50, max: 80 }, occasions: ["work"], ...over,
  });
const bottom = (over: Partial<FixtureTags> = {}) =>
  makeItem("2fbebb8f-3099-4889-af8b-346cc7de573d", "Bottom", {
    category: "bottom", colorFamily: "denim", formality: 3,
    tempRangeF: { min: 40, max: 70 }, occasions: ["work"], ...over,
  });
const coat = (over: Partial<FixtureTags> = {}) =>
  makeItem("93cf3279-cbb5-4b82-a81d-a3b3223db846", "Coat", {
    category: "outerwear", colorFamily: "brown", formality: 3,
    tempRangeF: { min: 0, max: 45 }, occasions: ["work"], ...over,
  });

describe("isComplementary", () => {
  it("allows the slots of an outfit, in either order", () => {
    expect(isComplementary("top", "bottom")).toBe(true);
    expect(isComplementary("bottom", "top")).toBe(true);
    expect(isComplementary("one_piece", "shoes")).toBe(true);
    expect(isComplementary("shoes", "outerwear")).toBe(true);
  });

  it("rejects same-slot, one-piece + top/bottom and accessories", () => {
    expect(isComplementary("top", "top")).toBe(false);
    expect(isComplementary("one_piece", "bottom")).toBe(false);
    expect(isComplementary("one_piece", "top")).toBe(false);
    expect(isComplementary("outerwear", "outerwear")).toBe(false);
    expect(isComplementary("accessory", "top")).toBe(false);
    expect(isComplementary("accessory", "shoes")).toBe(false);
  });
});

describe("checkRules", () => {
  it("passes a plain pair", () => {
    expect(checkRules(top(), bottom())).toEqual({ pass: true });
  });

  it("checks category first", () => {
    const result = checkRules(top(), top({ formality: 1, tempRangeF: { min: 90, max: 100 } }));
    expect(result).toMatchObject({ pass: false, rule: "category" });
  });

  it("allows a formality gap up to the limit", () => {
    expect(checkRules(top({ formality: 1 }), bottom({ formality: 1 + MAX_FORMALITY_GAP })).pass).toBe(true);
    expect(checkRules(top({ formality: 1 }), bottom({ formality: 2 + MAX_FORMALITY_GAP }))).toMatchObject({
      pass: false,
      rule: "formality",
    });
  });
});

describe("temperature rule", () => {
  it("needs overlapping ranges; touching at one degree is enough", () => {
    expect(checkRules(top({ tempRangeF: { min: 71, max: 90 } }), bottom())).toMatchObject({
      pass: false,
      rule: "temperature",
    });
    expect(checkRules(top({ tempRangeF: { min: 70, max: 90 } }), bottom()).pass).toBe(true);
  });

  it("treats a missing or invalid range as any temperature", () => {
    expect(checkRules(top({ tempRangeF: undefined }), bottom({ tempRangeF: { min: -10, max: 0 } })).pass).toBe(true);
    const inverted = top({ tempRangeF: { min: 90, max: 10 } });
    expect(inverted.tempRangeF).toBeUndefined();
    expect(checkRules(inverted, bottom()).pass).toBe(true);
  });

  it("doesn't compare outerwear with the top or one-piece it covers", () => {
    const tee = top({ tempRangeF: { min: 65, max: 95 } });
    expect(checkRules(coat(), tee).pass).toBe(true);
    expect(checkRules(tee, coat()).pass).toBe(true);
    const dress = top({ category: "one_piece", tempRangeF: { min: 65, max: 95 } });
    expect(checkRules(coat(), dress).pass).toBe(true);
  });

  it("still compares outerwear with exposed bottoms and shoes", () => {
    const shorts = bottom({ tempRangeF: { min: 75, max: 100 } });
    expect(checkRules(coat(), shorts)).toMatchObject({ pass: false, rule: "temperature" });
    const sandals = bottom({ category: "shoes", tempRangeF: { min: 70, max: 100 } });
    expect(checkRules(sandals, coat())).toMatchObject({ pass: false, rule: "temperature" });
  });
});

describe("color rule", () => {
  it("drops clashing primary color families", () => {
    expect(checkRules(top({ colorFamily: "pink" }), bottom({ colorFamily: "red" }))).toMatchObject({
      pass: false,
      rule: "color",
    });
    expect(checkRules(bottom({ colorFamily: "orange" }), top({ colorFamily: "purple" })).pass).toBe(false);
  });

  it("never clashes neutrals, multi, the same family or a missing family", () => {
    const red = bottom({ colorFamily: "red" });
    expect(checkRules(top({ colorFamily: "navy" }), red).pass).toBe(true);
    expect(checkRules(top({ colorFamily: "brown" }), bottom({ colorFamily: "pink" })).pass).toBe(true);
    expect(checkRules(top({ colorFamily: "multi" }), red).pass).toBe(true);
    expect(checkRules(top({ colorFamily: "red" }), red).pass).toBe(true);
    expect(checkRules(top({ colorFamily: undefined }), red).pass).toBe(true);
  });

  it("ignores color names and unknown families", () => {
    const named = top({ colors: [{ name: "hot pink" }], colorFamily: "white" });
    expect(checkRules(named, bottom({ colorFamily: "red" })).pass).toBe(true);
    const unknown = top({ colorFamily: "fuchsia" });
    expect(unknown.colorFamily).toBeUndefined();
    expect(checkRules(unknown, bottom({ colorFamily: "red" })).pass).toBe(true);
  });
});
