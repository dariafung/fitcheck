import { describe, expect, it } from "vitest";
import { filterBySize, type PoolBuyer } from "./pool";

const small: PoolBuyer = { id: "small", sizes: { top: "S", bottom: "S", shoe: "W6.5" } };
const large: PoolBuyer = { id: "large", sizes: { top: "L", bottom: "XL", shoe: "M9" } };

describe("filterBySize", () => {
  it("says there are no buyers before looking at sizes", () => {
    expect(filterBySize([], "M", "top")).toEqual({ state: "no_buyers" });
  });

  it("keeps the buyers the size fits", () => {
    expect(filterBySize([small, large], "XS", "top")).toEqual({ state: "ok", buyerIds: ["small"] });
    expect(filterBySize([small, large], "M", "top")).toEqual({ state: "ok", buyerIds: ["small", "large"] });
    expect(filterBySize([small, large], "W34", "bottom")).toEqual({ state: "ok", buyerIds: ["large"] });
    expect(filterBySize([small, large], "Men's 9", "shoes")).toEqual({ state: "ok", buyerIds: ["large"] });
  });

  it("tells a size no one fits apart from no buyers", () => {
    expect(filterBySize([small, large], "XXL", "one_piece")).toEqual({ state: "no_size_match" });
  });

  it("filters no one by a size it can't read, one size, or no size", () => {
    const everyone = { state: "ok", buyerIds: ["small", "large"] };
    expect(filterBySize([small, large], "Large Tall", "top")).toEqual(everyone);
    expect(filterBySize([small, large], "One size", "shoes")).toEqual(everyone);
    expect(filterBySize([small, large], null, "top")).toEqual(everyone);
  });
});
