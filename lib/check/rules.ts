// Rule pre-filter: cheap code checks that drop pairs before the model sees
// them. Values are exported so they can be tuned during testing.
import type { Category } from "../ai/schemas/common";
import { NEUTRAL_COLOR_FAMILIES, type ColorFamily } from "../color-families";
import { rangesOverlap, TEMP_F_MAX, TEMP_F_MIN, type TempRangeF } from "../temperature";
import { categoryOf, type ClosetItem } from "./types";

// Category pairs that can sit in the same outfit. Accessories never count.
export const COMPLEMENTARY_CATEGORIES: readonly (readonly [Category, Category])[] = [
  ["top", "bottom"],
  ["top", "shoes"],
  ["bottom", "shoes"],
  ["one_piece", "shoes"],
  ["outerwear", "top"],
  ["outerwear", "bottom"],
  ["outerwear", "one_piece"],
  ["outerwear", "shoes"],
];

// Formality is 1–5; a larger gap than this is dropped.
export const MAX_FORMALITY_GAP = 2;

// Color-family pairs that clearly clash. Neutral families and "multi" never
// clash; an item with no family never clashes.
export const CLASHING_COLOR_FAMILIES: readonly (readonly [ColorFamily, ColorFamily])[] = [
  ["red", "pink"],
  ["red", "orange"],
  ["orange", "pink"],
  ["orange", "purple"],
  ["red", "purple"],
];

// Outerwear goes over these, so their temperature ranges aren't compared.
export const COVERED_BY_OUTERWEAR: readonly Category[] = ["top", "one_piece"];

export type RuleName = "category" | "formality" | "temperature" | "color";

export type RuleResult =
  | { pass: true }
  | { pass: false; rule: RuleName; reason: string };

export function isComplementary(a: Category, b: Category): boolean {
  return COMPLEMENTARY_CATEGORIES.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

export function colorsClash(a: ClosetItem, b: ClosetItem): boolean {
  const fa = a.colorFamily;
  const fb = b.colorFamily;
  if (!fa || !fb) return false;
  if (NEUTRAL_COLOR_FAMILIES.includes(fa) || NEUTRAL_COLOR_FAMILIES.includes(fb)) return false;
  return CLASHING_COLOR_FAMILIES.some(
    ([x, y]) => (x === fa && y === fb) || (x === fb && y === fa),
  );
}

export const ANY_TEMPERATURE: TempRangeF = { min: TEMP_F_MIN, max: TEMP_F_MAX };

export function tempRangeOf(item: ClosetItem): TempRangeF {
  return item.tempRangeF ?? ANY_TEMPERATURE;
}

function covers(layer: ClosetItem, inner: ClosetItem): boolean {
  return categoryOf(layer) === "outerwear" && COVERED_BY_OUTERWEAR.includes(categoryOf(inner));
}

// Ranges must overlap, except outerwear over a top or one-piece: that layer
// is there precisely for colder weather than the inner piece handles.
export function temperaturesFit(a: ClosetItem, b: ClosetItem): boolean {
  if (covers(a, b) || covers(b, a)) return true;
  return rangesOverlap(tempRangeOf(a), tempRangeOf(b));
}

export function checkRules(a: ClosetItem, b: ClosetItem): RuleResult {
  if (!isComplementary(categoryOf(a), categoryOf(b))) {
    return { pass: false, rule: "category", reason: "Can't be worn together." };
  }
  if (Math.abs(a.tags.formality - b.tags.formality) > MAX_FORMALITY_GAP) {
    return { pass: false, rule: "formality", reason: "Too far apart in formality." };
  }
  if (!temperaturesFit(a, b)) {
    return { pass: false, rule: "temperature", reason: "No temperature in common." };
  }
  if (colorsClash(a, b)) {
    return { pass: false, rule: "color", reason: "Colors clash." };
  }
  return { pass: true };
}
