import { describe, expect, it } from "vitest";
import { FIX_REASON_MAX_WORDS, wordCount } from "@/lib/ai/schemas/pick-fix-outfit";
import { NO_FIX, PENDING_RETRIES, isLastTry, otherSaved, sameOutfit, shouldRetry } from "./item-outfits";

describe("shouldRetry", () => {
  it("asks again only while the feeling is being parsed, a few times", () => {
    expect(shouldRetry("pending", 0)).toBe(true);
    expect(shouldRetry("pending", PENDING_RETRIES - 1)).toBe(true);
    expect(shouldRetry("pending", PENDING_RETRIES)).toBe(false);
    expect(shouldRetry("none", 0)).toBe(false);
    expect(shouldRetry("no_fix", 0)).toBe(false);
    expect(shouldRetry("suggestion", 0)).toBe(false);
  });

  it("makes the try after the last retry the one that stops waiting", () => {
    expect(isLastTry(0)).toBe(false);
    expect(isLastTry(PENDING_RETRIES - 1)).toBe(false);
    expect(isLastTry(PENDING_RETRIES)).toBe(true);
    expect(shouldRetry("pending", PENDING_RETRIES - 1) && !shouldRetry("pending", PENDING_RETRIES)).toBe(true);
  });
});

describe("otherSaved", () => {
  const saved = [
    { id: "1", itemIds: ["a", "b", "c"] },
    { id: "2", itemIds: ["a", "b", "d"] },
  ];

  it("leaves out the suggested outfit, which shows its own saved state", () => {
    expect(otherSaved(saved, ["a", "b", "c"])).toEqual([saved[1]]);
    expect(otherSaved(saved, ["a", "b"])).toEqual(saved);
    expect(otherSaved(saved, null)).toEqual(saved);
  });

  it("compares outfits by their pieces", () => {
    expect(sameOutfit(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOutfit(["a", "b"], ["a", "b", "c"])).toBe(false);
  });
});

describe("copy", () => {
  it("keeps the nothing-helps line short and plain", () => {
    expect(NO_FIX).toBe("Nothing in your closet fixes this yet.");
    expect(wordCount(NO_FIX)).toBeLessThanOrEqual(FIX_REASON_MAX_WORDS);
  });
});
