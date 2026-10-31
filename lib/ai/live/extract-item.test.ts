import { describe, expect, it } from "vitest";
import { readSize } from "@/lib/resale/size";
import { toSize } from "./extract-item";

describe("toSize", () => {
  it("keeps the size as written, on one line", () => {
    expect(toSize("S")).toBe("S");
    expect(toSize("27 (US 4)")).toBe("27 (US 4)");
    expect(toSize("  XS\n")).toBe("XS");
    expect(toSize("W30  L32")).toBe("W30 L32");
  });

  it("drops a leading Size", () => {
    expect(toSize("Size: M")).toBe("M");
    expect(toSize("size 8")).toBe("8");
  });

  it("writes halves as .5 so resale matching can read them", () => {
    expect(toSize("7½")).toBe("7.5");
    expect(toSize("W 10 ½")).toBe("W 10.5");
    expect(toSize("7 1/2")).toBe("7.5");
    expect(readSize(toSize("7½")!, "shoes")).toEqual({ kind: "shoe", womenUs: 7.5 });
    // A waist and length is not a half size.
    expect(toSize("31/32")).toBe("31/32");
  });

  it("gives none for no size, a blank one or one too long to store", () => {
    expect(toSize(null)).toBeUndefined();
    expect(toSize("  ")).toBeUndefined();
    expect(toSize("Size:")).toBeUndefined();
    expect(toSize("x".repeat(21))).toBeUndefined();
  });
});
