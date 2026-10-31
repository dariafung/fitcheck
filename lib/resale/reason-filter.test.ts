import { describe, expect, it } from "vitest";
import { NO_FIT_SUMMARY } from "@/lib/check/buy-check";
import { allowedSentence, buyerReasons, FALLBACK_SUMMARY, JUDGY_WORDS, MAX_BUYER_REASONS } from "./reason-filter";

describe("allowedSentence", () => {
  it("drops every judging word, whole words in any case", () => {
    for (const word of JUDGY_WORDS) {
      expect(allowedSentence(`It ${word} things.`)).toBe(false);
      expect(allowedSentence(`It ${word.toUpperCase()} things.`)).toBe(false);
    }
    expect(allowedSentence("Hides your hips.")).toBe(false);
    expect(allowedSentence("Flattering  your waist.")).toBe(false);
  });

  it("keeps words that only contain one", () => {
    expect(allowedSentence("A heavyweight cotton you'd wear a lot.")).toBe(true);
    expect(allowedSentence("Flattering, and easy to wear.")).toBe(true);
  });

  it("drops heights and weights", () => {
    for (const s of ["Good at 165 cm.", "At 58kg it sits well.", "Fine for 120 lbs.", "At 5 ft it's long.", `Fits a 5'5" frame.`, "Fits a 5′5″ frame."]) {
      expect(allowedSentence(s)).toBe(false);
    }
  });

  it("keeps counts, item lengths and body shapes", () => {
    expect(allowedSentence("Makes 3 outfits with your closet.")).toBe(true);
    expect(allowedSentence(`Goes with your Speed Up Short 4".`)).toBe(true);
    expect(allowedSentence("Works for a pear shape, and a longer cut suits a taller frame.")).toBe(true);
  });
});

describe("buyerReasons", () => {
  it("keeps the summary's clean sentences, then the reasons", () => {
    expect(
      buyerReasons("Soft gray you like. It hides your hips.", ["Makes 3 outfits with your closet."]),
    ).toEqual(["Soft gray you like.", "Makes 3 outfits with your closet."]);
  });

  it("falls back when nothing is left of the summary, or there was nothing to go on", () => {
    expect(buyerReasons("Great at 165 cm.", [])).toEqual([FALLBACK_SUMMARY]);
    expect(buyerReasons(NO_FIT_SUMMARY, [])).toEqual([FALLBACK_SUMMARY]);
  });

  it("drops a reason with anything not allowed, and keeps at most three", () => {
    expect(buyerReasons("Nice.", ["Makes 2 outfits.", "Slimming on you.", "Fills a gap.", "Another."])).toEqual([
      "Nice.",
      "Makes 2 outfits.",
      "Fills a gap.",
    ]);
    expect(MAX_BUYER_REASONS).toBe(3);
  });
});
