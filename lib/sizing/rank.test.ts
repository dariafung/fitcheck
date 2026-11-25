import { describe, expect, it } from "vitest";
import { rankSize } from "./rank";

describe("rankSize", () => {
  it("orders letters, spelled out or not", () => {
    expect(rankSize("xs", "top")).toEqual({ label: "XS", scale: "letter", rank: 1 });
    expect(rankSize("Size Medium", "top")).toEqual({ label: "M", scale: "letter", rank: 3 });
    expect(rankSize("2XL", "top")).toEqual(rankSize("XXL", "top"));
  });

  it("keeps waists, US numbers and letters on separate scales", () => {
    expect(rankSize("27 (US 4)", "bottom")).toEqual({ label: "27", scale: "waist", rank: 27 });
    expect(rankSize("4", "bottom")).toEqual({ label: "4", scale: "number", rank: 4 });
    expect(rankSize("00", "bottom")?.rank).toBeLessThan(rankSize("0", "bottom")!.rank!);
    expect(rankSize("27", "top")?.scale).toBe("label");
  });

  it("reads shoes as US or EU", () => {
    expect(rankSize("7.5", "shoes")).toEqual({ label: "7.5", scale: "shoe_us", rank: 7.5 });
    expect(rankSize("38", "shoes")?.scale).toBe("shoe_eu");
  });

  it("only tells other sizes apart", () => {
    for (const text of ["S/M", "One size", "27x32"]) {
      expect(rankSize(text, "bottom"), text).toMatchObject({ scale: "label", rank: null });
    }
    expect(rankSize("  ", "top")).toBeNull();
  });
});
