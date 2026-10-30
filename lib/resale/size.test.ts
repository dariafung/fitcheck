import { describe, expect, it } from "vitest";
import {
  ItemSize,
  SHOE_SIZE_OPTIONS,
  ShoeSize,
  readSize,
  shoeSizeUs,
  sizeFits,
  sizeLabel,
  waistToLetter,
  type BuyerSizes,
} from "./size";

const letters = (...sizes: string[]) => ({ kind: "letters", sizes });
const shoe = (womenUs: number) => ({ kind: "shoe", womenUs });

describe("ShoeSize", () => {
  it("takes W or M and a US size from 4 to 15 in half sizes", () => {
    for (const ok of ["W4", "W4.5", "W7.5", "W10", "M14.5", "M15"]) {
      expect(ShoeSize.safeParse(ok).success, ok).toBe(true);
    }
    for (const bad of ["W3.5", "W15.5", "W8.0", "w8", "X8", "W 8", "8", "W8.25", "W"]) {
      expect(ShoeSize.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("offers every size as a valid value, women's first", () => {
    expect(SHOE_SIZE_OPTIONS).toHaveLength(46);
    expect(SHOE_SIZE_OPTIONS[0]).toEqual({ value: "W4", label: "Women's 4" });
    expect(SHOE_SIZE_OPTIONS[23]).toEqual({ value: "M4", label: "Men's 4" });
    expect(SHOE_SIZE_OPTIONS.at(-1)).toEqual({ value: "M15", label: "Men's 15" });
    expect(SHOE_SIZE_OPTIONS.every((o) => ShoeSize.safeParse(o.value).success)).toBe(true);
  });

  it("reads a men's size as women's plus 1.5", () => {
    expect(shoeSizeUs("W7.5")).toBe(7.5);
    expect(shoeSizeUs("M8")).toBe(9.5);
    expect(shoeSizeUs("bad")).toBeNull();
  });
});

describe("ItemSize", () => {
  it("trims, and takes 1 to 20 characters", () => {
    expect(ItemSize.parse("  US 8 ")).toBe("US 8");
    expect(ItemSize.safeParse("   ").success).toBe(false);
    expect(ItemSize.safeParse("x".repeat(21)).success).toBe(false);
  });
});

describe("readSize", () => {
  it("reads letter sizes however they are written", () => {
    expect(readSize("M", "top")).toEqual(letters("M"));
    expect(readSize(" medium ", "top")).toEqual(letters("M"));
    expect(readSize("Size: Small", "outerwear")).toEqual(letters("S"));
    expect(readSize("x-large", "one_piece")).toEqual(letters("XL"));
    expect(readSize("Extra Small", "top")).toEqual(letters("XS"));
    expect(readSize("XXS", "top")).toEqual(letters("XS"));
    expect(readSize("2XL", "top")).toEqual(letters("XXL"));
    expect(readSize("3XL", "top")).toEqual(letters("XXL"));
    expect(readSize("ｍ", "top")).toEqual(letters("M"));
  });

  it("reads a range as each of its sizes", () => {
    expect(readSize("S/M", "top")).toEqual(letters("S", "M"));
    expect(readSize("M - L", "top")).toEqual(letters("M", "L"));
    expect(readSize("8/10", "one_piece")).toEqual(letters("M"));
  });

  it("reads US and EU numbered sizes", () => {
    expect(readSize("0", "top")).toEqual(letters("XS"));
    expect(readSize("00", "top")).toEqual(letters("XS"));
    expect(readSize("US 6", "top")).toEqual(letters("S"));
    expect(readSize("12", "bottom")).toEqual(letters("L"));
    expect(readSize("EU 38", "top")).toEqual(letters("M"));
    expect(readSize("IT 42", "one_piece")).toEqual(letters("M"));
  });

  it("reads a waist for bottoms only", () => {
    expect(readSize("28", "bottom")).toEqual(letters("M"));
    expect(readSize("W30", "bottom")).toEqual(letters("L"));
    expect(readSize("30x32", "bottom")).toEqual(letters("L"));
    expect(readSize("W30 L32", "bottom")).toEqual(letters("L"));
    expect(readSize("30/32", "bottom")).toEqual(letters("L"));
    expect(readSize("38", "bottom")).toEqual(letters("XXL"));
    expect(readSize("38", "top")).toBeNull();
  });

  it("reads shoes as a women's US size", () => {
    expect(readSize("8", "shoes")).toEqual(shoe(8));
    expect(readSize("US 8.5", "shoes")).toEqual(shoe(8.5));
    expect(readSize("Women's 7", "shoes")).toEqual(shoe(7));
    expect(readSize("Men's 9", "shoes")).toEqual(shoe(10.5));
    expect(readSize("mens 9", "shoes")).toEqual(shoe(10.5));
    // A bare letter after the number is a width, not men's or women's.
    expect(readSize("8M", "shoes")).toEqual(shoe(8));
    expect(readSize("EU 38", "shoes")).toEqual(shoe(7));
    expect(readSize("39", "shoes")).toEqual(shoe(8));
  });

  it("reads one size as any size", () => {
    for (const text of ["One size", "OS", "o/s", "Free size"]) {
      expect(readSize(text, "top"), text).toEqual({ kind: "any" });
    }
    expect(readSize("one size", "shoes")).toEqual({ kind: "any" });
  });

  it("gives up on what it can't read", () => {
    for (const [text, category] of [
      ["Large Tall", "top"],
      ["8/10 petite", "one_piece"],
      ["92", "top"],
      ["M", "shoes"],
      ["8 or 9", "shoes"],
      ["8.25", "shoes"],
      ["3", "shoes"],
      ["", "top"],
    ] as const) {
      expect(readSize(text, category), text).toBeNull();
    }
  });
});

describe("waistToLetter", () => {
  it("follows the waist table at every edge", () => {
    expect([25, 26, 27, 28, 29, 30, 32, 33, 35, 36].map(waistToLetter)).toEqual([
      "XS", "S", "S", "M", "M", "L", "L", "XL", "XL", "XXL",
    ]);
  });
});

describe("sizeFits", () => {
  const buyer: BuyerSizes = { top: "M", bottom: "L", shoe: "W8" };

  it("lets letter sizes one step apart fit", () => {
    expect(sizeFits(readSize("S", "top")!, "top", buyer)).toBe(true);
    expect(sizeFits(readSize("L", "outerwear")!, "outerwear", buyer)).toBe(true);
    expect(sizeFits(readSize("XS", "top")!, "top", buyer)).toBe(false);
    expect(sizeFits(readSize("XL", "one_piece")!, "one_piece", buyer)).toBe(false);
    expect(sizeFits(readSize("XS/S", "top")!, "top", buyer)).toBe(true);
  });

  it("compares bottoms with the bottom size", () => {
    expect(sizeFits(readSize("XL", "bottom")!, "bottom", buyer)).toBe(true);
    expect(sizeFits(readSize("27", "bottom")!, "bottom", buyer)).toBe(false);
    expect(sizeFits(readSize("W28", "bottom")!, "bottom", buyer)).toBe(true);
  });

  it("lets shoes half a size apart fit, men's turned into women's", () => {
    expect(sizeFits(readSize("8.5", "shoes")!, "shoes", buyer)).toBe(true);
    expect(sizeFits(readSize("7.5", "shoes")!, "shoes", buyer)).toBe(true);
    expect(sizeFits(readSize("9", "shoes")!, "shoes", buyer)).toBe(false);
    expect(sizeFits(readSize("Men's 6.5", "shoes")!, "shoes", buyer)).toBe(true);
    expect(sizeFits(readSize("Men's 7.5", "shoes")!, "shoes", buyer)).toBe(false);
    const man = { ...buyer, shoe: "M8" };
    expect(sizeFits(readSize("9.5", "shoes")!, "shoes", man)).toBe(true);
    expect(sizeFits(readSize("10.5", "shoes")!, "shoes", man)).toBe(false);
  });

  it("lets one size fit anyone", () => {
    expect(sizeFits({ kind: "any" }, "top", buyer)).toBe(true);
    expect(sizeFits({ kind: "any" }, "shoes", buyer)).toBe(true);
  });
});

describe("sizeLabel", () => {
  it("doesn't double a typed Size", () => {
    expect(sizeLabel("M")).toBe("Size M");
    expect(sizeLabel("size 8")).toBe("Size 8");
    expect(sizeLabel("Size: W30")).toBe("Size W30");
  });
});
