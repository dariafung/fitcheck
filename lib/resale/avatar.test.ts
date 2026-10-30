import { describe, expect, it } from "vitest";
import { AVATAR_COLORS, anonBuyer } from "./avatar";

const ITEM = "0b4e7f52-8d1c-4a55-9f0e-2a6c1d3b9e10";
const OTHER_ITEM = "5c2d9a61-3e7b-4f08-b1a4-7d9e0c2f6a83";
const BUYER = "9e1f3c7a-2b5d-4e86-a0c9-4f7b2d1e8a35";

describe("anonBuyer", () => {
  it("is the same for the same item and buyer", () => {
    expect(anonBuyer(ITEM, BUYER)).toEqual(anonBuyer(ITEM, BUYER));
  });

  it("gives the same buyer another key on another item", () => {
    expect(anonBuyer(OTHER_ITEM, BUYER).key).not.toBe(anonBuyer(ITEM, BUYER).key);
  });

  it("never shows the buyer's id and picks one of the fixed colors", () => {
    const { key, color } = anonBuyer(ITEM, BUYER);
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(BUYER).not.toContain(key);
    expect(AVATAR_COLORS).toContain(color);
  });
});
