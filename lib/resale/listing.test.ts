import { describe, expect, it } from "vitest";
import { listingText, parsePrice, priceInput, priceText } from "./listing";

describe("parsePrice", () => {
  it("reads dollars with up to two decimals, with or without a $", () => {
    expect(parsePrice("25")).toBe(2500);
    expect(parsePrice(" $24.5 ")).toBe(2450);
    expect(parsePrice("$ 1,200.99")).toBe(120099);
    expect(parsePrice("0")).toBe(0);
  });

  it("is null for anything else", () => {
    for (const bad of ["", "abc", "-5", "1.999", "12.", "100001"]) expect(parsePrice(bad)).toBeNull();
  });
});

describe("priceText and priceInput", () => {
  it("drop cents on whole dollars", () => {
    expect(priceText(2500)).toBe("$25");
    expect(priceText(2450)).toBe("$24.50");
    expect(priceInput(2500)).toBe("25");
    expect(priceInput(2450)).toBe("24.50");
    expect(priceInput(null)).toBe("");
  });
});

describe("listingText", () => {
  it("names the price and the condition", () => {
    expect(listingText(1200, "like_new")).toBe("Asking $12 · Like new");
    expect(listingText(1200, null)).toBe("Asking $12");
    expect(listingText(null, "good")).toBe("Good");
    expect(listingText(null, "mint")).toBeNull();
  });
});
