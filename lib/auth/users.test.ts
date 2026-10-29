import { describe, expect, it } from "vitest";
import { displayNameFor } from "./users";

describe("displayNameFor", () => {
  it("takes the part before the @", () => {
    expect(displayNameFor("jo.lee@example.com")).toBe("jo.lee");
  });

  it("falls back when there's nothing to use", () => {
    expect(displayNameFor("@example.com")).toBe("me");
    expect(displayNameFor("")).toBe("me");
    expect(displayNameFor(null)).toBe("me");
  });
});
