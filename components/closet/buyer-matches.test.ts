import { describe, expect, it } from "vitest";
import { MAX_AVATARS, avatarRow, buyerCount } from "./buyer-matches";

describe("avatarRow", () => {
  it("draws one avatar per match up to the cap", () => {
    expect(avatarRow(1)).toEqual({ shown: 1, more: 0 });
    expect(avatarRow(MAX_AVATARS)).toEqual({ shown: MAX_AVATARS, more: 0 });
  });

  it("puts the rest in +N", () => {
    expect(avatarRow(12)).toEqual({ shown: 5, more: 7 });
  });
});

describe("buyerCount", () => {
  it("says person for one and people for more", () => {
    expect(buyerCount(1)).toBe("1 person in your size would likely want this.");
    expect(buyerCount(3)).toBe("3 people in your size would likely want this.");
  });
});
