import { describe, expect, it } from "vitest";
import { MAX_AVATARS, avatarRow, shownToBuyers } from "./buyer-matches";

describe("avatarRow", () => {
  it("draws one avatar per match up to the cap", () => {
    expect(avatarRow(1)).toEqual({ shown: 1, more: 0 });
    expect(avatarRow(MAX_AVATARS)).toEqual({ shown: MAX_AVATARS, more: 0 });
  });

  it("puts the rest in +N", () => {
    expect(avatarRow(12)).toEqual({ shown: 5, more: 7 });
  });
});

describe("shownToBuyers", () => {
  it("says buyer for one and buyers for more", () => {
    expect(shownToBuyers(1)).toBe("We've shown this to 1 buyer in your size.");
    expect(shownToBuyers(3)).toBe("We've shown this to 3 buyers in your size.");
  });
});
