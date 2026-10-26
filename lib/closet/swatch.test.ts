import { describe, expect, it } from "vitest";
import { COLOR_FAMILY_HEX } from "@/lib/color-families";
import { FALLBACK_SWATCH, familyFromName, swatchHex } from "./swatch";

const tags = (colorName: string | null, extra: object = {}) => ({
  category: "bottom",
  colors: colorName ? [{ name: colorName }] : [],
  materials: [],
  formality: 2,
  seasons: [],
  occasions: [],
  ...extra,
});

describe("familyFromName", () => {
  it("maps common color names to a family", () => {
    expect(familyFromName("indigo")).toBe("denim");
    expect(familyFromName("Dark wash denim")).toBe("denim");
    expect(familyFromName("navy blue")).toBe("navy");
    expect(familyFromName("light blue")).toBe("blue");
    expect(familyFromName("off-white")).toBe("cream");
    expect(familyFromName("white")).toBe("white");
    expect(familyFromName("sage")).toBe("green");
    expect(familyFromName("charcoal grey")).toBe("gray");
    expect(familyFromName("tangerine")).toBe("orange");
  });

  it("gives up on names it does not know", () => {
    expect(familyFromName("mystery")).toBeNull();
    expect(familyFromName("primrose")).toBeNull();
  });
});

describe("swatchHex", () => {
  it("uses the color family, the user's first", () => {
    expect(swatchHex({ category: "bottom", ai_tags: tags("indigo", { colorFamily: "navy" }), user_tags: {} })).toBe(
      COLOR_FAMILY_HEX.navy,
    );
    expect(
      swatchHex({ category: "bottom", ai_tags: tags("indigo", { colorFamily: "navy" }), user_tags: { colorFamily: "black" } }),
    ).toBe(COLOR_FAMILY_HEX.black);
  });

  it("falls back to the color name, then to light gray, never to the raw name", () => {
    expect(swatchHex({ category: "bottom", ai_tags: tags("indigo"), user_tags: {} })).toBe(COLOR_FAMILY_HEX.denim);
    expect(swatchHex({ category: "bottom", ai_tags: tags("mystery"), user_tags: {} })).toBe(FALLBACK_SWATCH);
    expect(swatchHex({ category: "bottom", ai_tags: tags(null), user_tags: {} })).toBe(FALLBACK_SWATCH);
    expect(swatchHex({ category: "bottom", ai_tags: tags("red", { colorFamily: "rainbow" }), user_tags: {} })).toBe(
      COLOR_FAMILY_HEX.red,
    );
  });
});
