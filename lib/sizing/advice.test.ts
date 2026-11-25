import { describe, expect, it } from "vitest";
import type { Category, ItemTags } from "../ai/schemas/common";
import { sizeAdvice, type PageSizing, type UsualSizes, type WornSize } from "./advice";
import type { SizeFit } from "./fit";

const USUAL: UsualSizes = { top: "S", bottom: "S", shoe: "W7.5" };

function tags(category: Category = "top", materials: string[] = []): ItemTags {
  return { category, colors: [], materials, formality: 2, occasions: [] };
}
const worn = (size: string, sizeFit: SizeFit, brand = "HOLLISTER", category: Category = "top"): WornSize => ({
  brand,
  category,
  size,
  sizeFit,
});
const advise = (page: PageSizing, history: WornSize[], t = tags()) => sizeAdvice({ tags: t, page }, history, USUAL);

describe("sizeAdvice: one ledger per brand and type", () => {
  const history = [worn("XS", "small"), worn("M", "right", "HOLLISTER", "bottom"), worn("L", "right", "HOLLISTER", "outerwear")];

  it("never lends a brand's tops to its bottoms or jackets", () => {
    expect(advise({ brand: "HOLLISTER" }, history)?.text).toBe("XS is too small on you in HOLLISTER tops. Skip XS.");
    expect(advise({ brand: "HOLLISTER" }, history, tags("bottom"))?.text).toBe("M fits you in HOLLISTER bottoms. Go with M.");
    expect(advise({ brand: "HOLLISTER" }, history, tags("outerwear"))?.text).toBe("L fits you in HOLLISTER jackets. Go with L.");
    expect(advise({ brand: "HOLLISTER" }, history, tags("one_piece"))).toMatchObject({ kind: "unknown" });
  });

  it("never lends one brand to another, but reads every spelling of one", () => {
    expect(advise({ brand: "ZARA" }, history)).toMatchObject({ kind: "unknown", text: "No size history with ZARA tops yet." });
    expect(advise({ brand: "Hollister Co." }, history)?.kind).toBe("avoid");
  });
});

describe("sizeAdvice: what the history says", () => {
  it("compares with the size picked on the page", () => {
    const history = [worn("S", "right")];
    expect(advise({ brand: "HOLLISTER", size: "S" }, history)?.text).toBe("S fits you in HOLLISTER tops.");
    expect(advise({ brand: "HOLLISTER", size: "M" }, history)?.text).toBe("You picked M, but S fits you in HOLLISTER tops.");
    expect(advise({ brand: "HOLLISTER", size: "XS" }, [worn("XS", "small")])?.text).toBe(
      "You picked XS. XS is too small on you in HOLLISTER tops. Skip XS.",
    );
  });

  it("names both ends when nothing fit", () => {
    expect(advise({ brand: "HOLLISTER" }, [worn("L", "large"), worn("XS", "small")])).toMatchObject({
      kind: "avoid",
      text: "XS is too small on you and L is too big on you in HOLLISTER tops. Skip XS and L.",
    });
  });

  it("gives no pick when the history contradicts itself", () => {
    expect(advise({ brand: "HOLLISTER" }, [worn("S", "right"), worn("S", "small")])?.kind).toBe("mixed");
    // A bigger size too small than one that fit.
    expect(advise({ brand: "HOLLISTER" }, [worn("S", "right"), worn("M", "small")])?.kind).toBe("mixed");
    expect(advise({ brand: "HOLLISTER" }, [worn("S", "right"), worn("M", "right")])).toMatchObject({
      kind: "fits",
      text: "S and M fit you in HOLLISTER tops.",
    });
  });

  it("compares only within one scale, the picked size's first", () => {
    const history = [worn("S", "right", "ZARA", "bottom"), worn("S", "right", "ZARA", "bottom"), worn("27", "small", "ZARA", "bottom")];
    expect(advise({ brand: "ZARA" }, history, tags("bottom"))?.kind).toBe("fits");
    expect(advise({ brand: "ZARA", size: "27" }, history, tags("bottom"))?.text).toBe(
      "You picked 27. 27 is too small on you in ZARA bottoms. Skip 27.",
    );
  });

  it("says how many pieces it's based on, and no stretch only beside too small", () => {
    expect(advise({ brand: "HOLLISTER" }, [worn("XS", "small")], tags("top", ["cotton"]))?.notes).toEqual([
      "Based on 1 piece you marked.",
      "No stretch fiber listed, so don't count on it giving.",
    ]);
    expect(advise({ brand: "HOLLISTER" }, [worn("XS", "small")], tags("top", ["cotton", "elastane"]))?.notes).toHaveLength(1);
    expect(advise({ brand: "HOLLISTER" }, [worn("S", "right")], tags("top", ["cotton"]))?.notes).toHaveLength(1);
    expect(advise({ brand: "HOLLISTER" }, [worn("XS", "small")])?.notes).toHaveLength(1);
  });
});

describe("sizeAdvice: shopper feedback", () => {
  const small = { runs: "small" as const, quotes: ["Runs small, size up"] };

  it("leans on it only with no history of their own, and names no size to buy", () => {
    expect(advise({ brand: "HOLLISTER", shopperFit: small }, [])).toEqual({
      kind: "shoppers",
      text: "Shoppers say it runs small.",
      notes: [
        "You usually wear S. Consider a size up.",
        "No size history with HOLLISTER tops yet.",
        "Shopper feedback: “Runs small, size up”",
      ],
    });
  });

  it("is only a note under their own history", () => {
    const advice = advise({ brand: "HOLLISTER", shopperFit: small }, [worn("S", "right")]);
    expect(advice?.kind).toBe("fits");
    expect(advice?.notes.at(-1)).toBe("Shopper feedback: “Runs small, size up”");
  });

  it("still shows without a brand; without either there is nothing to say", () => {
    expect(advise({ shopperFit: small }, [])?.kind).toBe("shoppers");
    expect(advise({}, [worn("S", "right")])).toBeNull();
  });

  it("has no usual size for jackets", () => {
    expect(advise({ brand: "HOLLISTER" }, [], tags("outerwear"))?.notes).toEqual([]);
    expect(advise({ brand: "ASICS" }, [], tags("shoes"))?.notes).toEqual(["You usually wear women's 7.5."]);
  });
});
