import { describe, expect, it } from "vitest";
import { smallClosetNote, STARTER_TARGET, starterAfterSave, starterLabel, starterProgress } from "./starter";

describe("starterProgress", () => {
  it("counts up to the target and then goes away", () => {
    expect(STARTER_TARGET).toBe(5);
    expect(starterProgress(0)).toEqual({ count: 0, target: 5, left: 5 });
    expect(starterProgress(3)).toEqual({ count: 3, target: 5, left: 2 });
    expect(starterProgress(4)).toEqual({ count: 4, target: 5, left: 1 });
    expect(starterProgress(5)).toBeNull();
    expect(starterProgress(18)).toBeNull();
  });

  it("never goes below zero", () => {
    expect(starterProgress(-2)).toEqual({ count: 0, target: 5, left: 5 });
  });

  it("reads as '3 of 5'", () => {
    expect(starterLabel(starterProgress(3)!)).toBe("3 of 5");
    expect(starterLabel(starterProgress(0)!)).toBe("0 of 5");
  });
});

describe("starterAfterSave", () => {
  it("says how many are left while under the target", () => {
    expect(starterAfterSave(1)).toEqual({ reached: false, text: "4 more to go for your first 5." });
    expect(starterAfterSave(4)).toEqual({ reached: false, text: "1 more to go for your first 5." });
  });

  it("marks the save that reaches the target, once", () => {
    expect(starterAfterSave(5)).toEqual({ reached: true, text: "That's your first 5." });
    expect(starterAfterSave(6)).toBeNull();
    expect(starterAfterSave(19)).toBeNull();
  });
});

describe("smallClosetNote", () => {
  it("stands in for the verdict under the target", () => {
    expect(smallClosetNote(1)).toBe("Based on 1 piece. Add more for a verdict.");
    expect(smallClosetNote(3)).toBe("Based on 3 pieces. Add more for a verdict.");
    expect(smallClosetNote(4)).toBe("Based on 4 pieces. Add more for a verdict.");
  });

  it("leaves the empty closet and a full enough one alone", () => {
    expect(smallClosetNote(0)).toBeNull();
    expect(smallClosetNote(5)).toBeNull();
    expect(smallClosetNote(40)).toBeNull();
  });
});
