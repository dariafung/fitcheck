import { COLOR_FAMILIES, COLOR_FAMILY_HEX, type ColorFamily } from "@/lib/color-families";
import { itemTags } from "./tags";

// Shown when no color family can be found. Color names never reach CSS.
export const FALLBACK_SWATCH = "#e5e5e5";

// For items tagged before color families existed: keywords in the color name,
// checked in order, so "navy" wins over "blue" and "off-white" over "white".
const NAME_KEYWORDS: [ColorFamily, string[]][] = [
  ["denim", ["denim", "indigo", "jean", "chambray"]],
  ["navy", ["navy", "midnight"]],
  ["cream", ["off-white", "off white", "cream", "ivory", "ecru", "beige", "oatmeal", "sand", "stone", "bone"]],
  ["white", ["white"]],
  ["black", ["black", "jet", "onyx"]],
  ["gray", ["gray", "grey", "charcoal", "silver", "heather", "slate"]],
  ["orange", ["orange", "tangerine", "rust", "coral", "terracotta", "peach"]],
  ["brown", ["brown", "tan", "camel", "chocolate", "mocha", "khaki", "taupe", "cognac"]],
  ["green", ["green", "olive", "sage", "emerald", "mint", "forest"]],
  ["red", ["red", "burgundy", "maroon", "wine", "crimson", "oxblood"]],
  ["pink", ["pink", "blush", "rose", "fuchsia", "magenta"]],
  ["yellow", ["yellow", "mustard", "gold", "lemon"]],
  ["purple", ["purple", "lilac", "lavender", "violet", "plum", "mauve"]],
  ["blue", ["blue", "teal", "cobalt", "turquoise", "aqua", "sky"]],
  ["multi", ["multi", "print", "floral", "stripe", "plaid", "check"]],
];

export function familyFromName(name: string): ColorFamily | null {
  const text = name.toLowerCase();
  for (const [family, words] of NAME_KEYWORDS) {
    if (words.some((w) => new RegExp(`\\b${w}`).test(text))) return family;
  }
  return null;
}

function asFamily(value: unknown): ColorFamily | null {
  return COLOR_FAMILIES.includes(value as ColorFamily) ? (value as ColorFamily) : null;
}

function field(tags: unknown, key: string): unknown {
  return typeof tags === "object" && tags !== null ? (tags as Record<string, unknown>)[key] : undefined;
}

// Swatch for an item without a photo: the user's color family, else the AI's,
// else a guess from the first color name, else light gray.
export function swatchHex(row: { category: string; ai_tags: unknown; user_tags: unknown }): string {
  const name = itemTags(row).colors[0]?.name;
  const family =
    asFamily(field(row.user_tags, "colorFamily")) ??
    asFamily(field(row.ai_tags, "colorFamily")) ??
    (name ? familyFromName(name) : null);
  return family ? COLOR_FAMILY_HEX[family] : FALLBACK_SWATCH;
}
