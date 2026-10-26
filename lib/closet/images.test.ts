import { describe, expect, it } from "vitest";
import { isExternalUrl } from "./images";

describe("isExternalUrl", () => {
  it("tells full URLs from storage paths", () => {
    expect(isExternalUrl("https://cdn.example.com/a.jpg")).toBe(true);
    expect(isExternalUrl("HTTP://example.com/a.jpg")).toBe(true);
    expect(isExternalUrl("items/abc/front.webp")).toBe(false);
  });
});
