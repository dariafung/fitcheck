import { describe, expect, it } from "vitest";
import { buyersInSize } from "./buyer-matches";

describe("buyersInSize", () => {
  it("says buyer for one and buyers for more", () => {
    expect(buyersInSize(1)).toBe("buyer in your size");
    expect(buyersInSize(3)).toBe("buyers in your size");
  });
});
