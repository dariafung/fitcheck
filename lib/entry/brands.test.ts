import { describe, expect, it } from "vitest";
import { alignBrand, BRANDS, brandKey, MAX_BRAND_SUGGESTIONS, savedBrandNames, suggestBrands } from "./brands";

describe("brandKey", () => {
  it("ignores case, spaces, punctuation and accents, and reads & as and", () => {
    expect(brandKey("H & M")).toBe("handm");
    expect(brandKey("h&m")).toBe("handm");
    expect(brandKey("H and M")).toBe("handm");
    expect(brandKey("Abercrombie and Fitch")).toBe(brandKey("Abercrombie & Fitch"));
    expect(brandKey("Levi’s")).toBe("levis");
    expect(brandKey(" lulu lemon ")).toBe("lululemon");
    expect(brandKey("Stüssy")).toBe("stussy");
    expect(brandKey("J.Crew")).toBe("jcrew");
    expect(brandKey("Pull + Bear")).toBe("pullandbear");
  });

  it("gives every built-in name and alias a key of its own", () => {
    const keys = BRANDS.flatMap((b) => [b.name, ...(b.aliases ?? [])]).map(brandKey);
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("alignBrand", () => {
  it("swaps in the built-in logo spelling", () => {
    expect(alignBrand("Zara", [])).toBe("ZARA");
    expect(alignBrand("LULULEMON", [])).toBe("lululemon");
    expect(alignBrand("Asics", [])).toBe("ASICS");
    expect(alignBrand("h & m", [])).toBe("H&M");
    expect(alignBrand("Abercrombie and Fitch", [])).toBe("ABERCROMBIE & FITCH");
    expect(alignBrand("Uniqlo", [])).toBe("UNIQLO");
    expect(alignBrand("Adidas", [])).toBe("adidas");
  });

  it("reads aliases as their brand", () => {
    expect(alignBrand("Hollister Co.", [])).toBe("HOLLISTER");
    expect(alignBrand("lululemon athletica", [])).toBe("lululemon");
    expect(alignBrand("A&F", [])).toBe("ABERCROMBIE & FITCH");
    expect(alignBrand("The North Face", [])).toBe("THE NORTH FACE");
    expect(alignBrand("north face", [])).toBe("THE NORTH FACE");
  });

  it("prefers the user's own spelling, alias or not", () => {
    expect(alignBrand("LULULEMON", ["Lululemon"])).toBe("Lululemon");
    expect(alignBrand("Abercrombie & Fitch", ["Abercrombie"])).toBe("Abercrombie");
    // The user's spelling of a brand the list doesn't know.
    expect(alignBrand("fieldnote supply", ["Fieldnote Supply"])).toBe("Fieldnote Supply");
  });

  it("keeps an unknown brand as read, trimmed", () => {
    expect(alignBrand("  Tiny Studio ", [])).toBe("Tiny Studio");
    expect(alignBrand("ユニクロ", [])).toBe("ユニクロ");
  });

  it("matches nothing fuzzy", () => {
    expect(alignBrand("Nikee", [])).toBe("Nikee");
    expect(alignBrand("Gant", ["GAP"])).toBe("Gant");
  });

  it("gives no brand for an empty one", () => {
    expect(alignBrand(undefined, [])).toBeUndefined();
    expect(alignBrand("   ", ["ZARA"])).toBeUndefined();
  });
});

describe("savedBrandNames", () => {
  const row = (brand: string, savedAt = "2026-10-01T00:00:00Z") => ({ brand, savedAt });

  it("lists each brand once, the most saved first", () => {
    expect(
      savedBrandNames([row("Tiny Studio"), row("ZARA"), row("zara"), row("ZARA"), row("Tiny Studio"), row("NIKE")]),
    ).toEqual(["ZARA", "Tiny Studio", "NIKE"]);
  });

  it("picks the built-in spelling, else the most used, else the latest", () => {
    expect(savedBrandNames([row("Zara"), row("Zara"), row("ZARA")])).toEqual(["ZARA"]);
    expect(savedBrandNames([row("Zara"), row("Zara"), row("zara")])).toEqual(["Zara"]);
    expect(
      savedBrandNames([row("tiny studio", "2026-10-01T00:00:00Z"), row("Tiny Studio", "2026-10-05T00:00:00Z")]),
    ).toEqual(["Tiny Studio"]);
  });

  it("counts an alias with its brand", () => {
    expect(savedBrandNames([row("Abercrombie"), row("Abercrombie"), row("A&F")])).toEqual(["Abercrombie"]);
  });

  it("breaks ties between brands by the latest save", () => {
    expect(
      savedBrandNames([row("Tiny Studio", "2026-10-01T00:00:00Z"), row("ZARA", "2026-10-09T00:00:00Z")]),
    ).toEqual(["ZARA", "Tiny Studio"]);
  });

  it("skips blank brands", () => {
    expect(savedBrandNames([row(" "), row("!!")])).toEqual([]);
  });
});

describe("suggestBrands", () => {
  it("offers nothing for an empty box", () => {
    expect(suggestBrands("", ["ZARA"])).toEqual([]);
    expect(suggestBrands("  ", [])).toEqual([]);
  });

  it("lists the user's brands before the built-in ones", () => {
    expect(suggestBrands("h", ["Hollister Co. Kids", "Tiny Studio"]).slice(0, 2)).toEqual(["Hollister Co. Kids", "H&M"]);
  });

  it("puts names that start with the text before later words", () => {
    const list = suggestBrands("fi", []);
    expect(list.indexOf("FILA")).toBeLessThan(list.indexOf("ABERCROMBIE & FITCH"));
    expect(list).toContain("ABERCROMBIE & FITCH");
  });

  it("matches later words and aliases", () => {
    expect(suggestBrands("fitch", [])).toEqual(["ABERCROMBIE & FITCH"]);
    expect(suggestBrands("hm", [])).toContain("H&M");
    expect(suggestBrands("athletica", [])).toEqual(["lululemon"]);
    expect(suggestBrands("aber", [])).toEqual(["ABERCROMBIE & FITCH"]);
  });

  it("shows the user's spelling instead of the built-in one", () => {
    expect(suggestBrands("lulu", ["Lululemon"])).toEqual(["Lululemon"]);
    expect(suggestBrands("fitch", ["Abercrombie"])).toEqual(["Abercrombie"]);
  });

  it("ignores case and punctuation in what's typed", () => {
    expect(suggestBrands("H &", [])[0]).toBe("H&M");
    expect(suggestBrands("ZAR", [])).toEqual(["ZARA"]);
  });

  it("lists at most a handful", () => {
    expect(suggestBrands("s", []).length).toBe(MAX_BRAND_SUGGESTIONS);
  });
});
