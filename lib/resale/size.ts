// Sizes for resale matching. An item's size is whatever its owner typed
// (M, 28, US 8); a profile's sizes come from fixed lists. Code reads the
// typed size here and compares it with a buyer's.
// No server-only imports: the profile form and the item page use this too.
import { z } from "zod";
import type { Category } from "@/lib/ai/schemas/common";

export const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export const LetterSize = z.enum(LETTER_SIZES);
export type LetterSize = z.infer<typeof LetterSize>;

// What an item's size may be: typed text, kept as typed. Same limits as
// the items.size column.
export const MAX_ITEM_SIZE_LENGTH = 20;
export const ITEM_SIZE_PLACEHOLDER = "M, 28, US 8";
export const ItemSize = z.string().trim().min(1).max(MAX_ITEM_SIZE_LENGTH);

// A profile's shoe size: the fit and the US size in one value, W7.5 or M9.
// Half sizes end in .5, whole sizes have no .0. Same rule as the column check.
export const SHOE_SIZE_PATTERN = /^[WM](([4-9]|1[0-4])(\.5)?|15)$/;
export const ShoeSize = z.string().regex(SHOE_SIZE_PATTERN);
export type ShoeSize = z.infer<typeof ShoeSize>;

const SHOE_MIN_US = 4;
const SHOE_MAX_US = 15;

function shoeNumbers(): number[] {
  const sizes: number[] = [];
  for (let us = SHOE_MIN_US; us <= SHOE_MAX_US; us += 0.5) sizes.push(us);
  return sizes;
}

// Women's first, then men's, half a size apart.
export const SHOE_SIZE_OPTIONS: { value: ShoeSize; label: string }[] = (["W", "M"] as const).flatMap((fit) =>
  shoeNumbers().map((us) => ({
    value: `${fit}${us}`,
    label: `${fit === "W" ? "Women's" : "Men's"} ${us}`,
  })),
);

// A men's US shoe size is about a women's size 1.5 larger.
export const MEN_TO_WOMEN_US_OFFSET = 1.5;
// Shoes this many US sizes apart still fit.
export const SHOE_SIZE_TOLERANCE = 0.5;
// Letter sizes this many steps apart still fit (brands differ by about one).
export const LETTER_TOLERANCE = 1;

// Women's US size of a profile's shoe size.
export function shoeSizeUs(value: string): number | null {
  if (!SHOE_SIZE_PATTERN.test(value)) return null;
  const us = Number(value.slice(1));
  return value[0] === "M" ? us + MEN_TO_WOMEN_US_OFFSET : us;
}

export interface BuyerSizes {
  top: LetterSize;
  bottom: LetterSize;
  shoe: ShoeSize;
}

// A typed size, read: any size fits (one size), one or more letter sizes
// (S/M gives both), or a women's US shoe size.
export type ReadSize =
  | { kind: "any" }
  | { kind: "letters"; sizes: LetterSize[] }
  | { kind: "shoe"; womenUs: number };

const ONE_SIZE = /^(ONE ?SIZE|OS|O\/S|FREE ?SIZE)$/;

// Spelled-out sizes, longest first so "X-LARGE" is not read as "LARGE".
const LETTER_WORDS: [RegExp, string][] = [
  [/\b(XX|2X)[- ]?LARGE\b/g, "XXL"],
  [/\b(XX|2X)[- ]?SMALL\b/g, "XXS"],
  [/\b(X|EXTRA)[- ]?LARGE\b/g, "XL"],
  [/\b(X|EXTRA)[- ]?SMALL\b/g, "XS"],
  [/\b(SMALL|SM)\b/g, "S"],
  [/\b(MEDIUM|MED)\b/g, "M"],
  [/\b(LARGE|LG)\b/g, "L"],
];

const LETTER_CODES: Record<string, LetterSize> = {
  XXS: "XS",
  XS: "XS",
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
  XXL: "XXL",
  "2XL": "XXL",
  XXXL: "XXL",
  "3XL": "XXL",
  "4XL": "XXL",
};

// Waist in inches → letter size.
export function waistToLetter(waistIn: number): LetterSize {
  if (waistIn <= 25) return "XS";
  if (waistIn <= 27) return "S";
  if (waistIn <= 29) return "M";
  if (waistIn <= 32) return "L";
  if (waistIn <= 35) return "XL";
  return "XXL";
}

// US women's numeric size (0–22) → letter size.
function usNumberToLetter(n: number): LetterSize {
  if (n <= 2) return "XS";
  if (n <= 6) return "S";
  if (n <= 10) return "M";
  if (n <= 14) return "L";
  if (n <= 18) return "XL";
  return "XXL";
}

// EU women's size → letter size.
function euToLetter(n: number): LetterSize | null {
  if (n < 32) return null;
  if (n <= 34) return "XS";
  if (n <= 36) return "S";
  if (n <= 38) return "M";
  if (n <= 40) return "L";
  if (n <= 42) return "XL";
  return "XXL";
}

const US_NUMBER_MAX = 22;
const WAIST_MIN_IN = 23;
const WAIST_MAX_IN = 44;

// Upper case, half-width, single spaces, no leading "Size" / "Sz:".
function clean(text: string): string {
  return text
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(SIZE|SZ)\b[:.]?\s*/, "")
    .trim();
}

// One part of a clothing size (no ranges).
function readClothingPart(part: string, category: Category): LetterSize | null {
  const letter = LETTER_CODES[part];
  if (letter) return letter;

  const eu = part.match(/^(EU|FR|IT) ?(\d{2})$/);
  if (eu) return euToLetter(Number(eu[2]) - (eu[1] === "IT" ? 4 : 0));

  const us = part.match(/^(?:US ?)?(00|\d{1,2})$/);
  if (us && Number(us[1]) <= US_NUMBER_MAX) return usNumberToLetter(Number(us[1]));

  if (category === "bottom") {
    // 30, W30, 30W, 30x32, W30 L32.
    const waist = part.match(/^W?(\d{2})W?(?: ?[X/] ?\d{2}| ?L ?\d{2})?$/);
    if (waist) {
      const inches = Number(waist[1]);
      if (inches >= WAIST_MIN_IN && inches <= WAIST_MAX_IN) return waistToLetter(inches);
    }
  }
  return null;
}

function readClothing(text: string, category: Category): ReadSize | null {
  let words = text;
  for (const [pattern, code] of LETTER_WORDS) words = words.replace(pattern, code);
  // A range (S/M, M-L, 8/10) fits any of its sizes. A waist and length
  // (30/32) is not a range, so try the whole text first.
  const whole = readClothingPart(words, category);
  if (whole) return { kind: "letters", sizes: [whole] };
  const parts = words.split(/ ?[/–-] ?/);
  if (parts.length < 2) return null;
  const sizes = parts.map((p) => readClothingPart(p, category));
  if (sizes.some((s) => s === null)) return null;
  return { kind: "letters", sizes: [...new Set(sizes as LetterSize[])] };
}

const EU_SHOE_MIN = 34;
const EU_SHOE_MAX = 47;
// EU shoe size → women's US: EU 38 is about US 7.
const EU_TO_WOMEN_US = 31;

// Only a spelled-out men's marks a men's size; a bare M or W after the
// number is a width (8M, 8W).
function readShoe(text: string): ReadSize | null {
  const women = /\b(WOMEN'?S?|WMNS|W'S)\b/.test(text);
  const men = !women && /\b(MEN'?S?|M'S)\b/.test(text);
  const numbers = text.match(/\d+(\.\d+)?/g);
  if (!numbers || numbers.length !== 1) return null;
  const n = Number(numbers[0]);
  if (!Number.isInteger(n * 2)) return null;
  const euMarked = /\bEU\b/.test(text);
  if (euMarked || (n >= EU_SHOE_MIN && n <= EU_SHOE_MAX)) {
    if (n < EU_SHOE_MIN || n > EU_SHOE_MAX) return null;
    return { kind: "shoe", womenUs: n - EU_TO_WOMEN_US };
  }
  if (n < SHOE_MIN_US || n > SHOE_MAX_US + 0.5) return null;
  return { kind: "shoe", womenUs: men ? n + MEN_TO_WOMEN_US_OFFSET : n };
}

// Reads a typed size for an item of this category; null when it can't be
// read, and then buyers aren't filtered by size.
export function readSize(text: string, category: Category): ReadSize | null {
  const cleaned = clean(text);
  if (!cleaned) return null;
  if (ONE_SIZE.test(cleaned)) return { kind: "any" };
  return category === "shoes" ? readShoe(cleaned) : readClothing(cleaned, category);
}

// Whether a buyer's sizes fit an item's size as read. Shoes compare with the
// buyer's shoe size, bottoms with their bottom size, everything else with
// their top size.
export function sizeFits(size: ReadSize, category: Category, buyer: BuyerSizes): boolean {
  if (size.kind === "any") return true;
  if (size.kind === "shoe") {
    if (category !== "shoes") return false;
    const theirs = shoeSizeUs(buyer.shoe);
    return theirs !== null && Math.abs(theirs - size.womenUs) <= SHOE_SIZE_TOLERANCE;
  }
  if (category === "shoes") return false;
  const theirs = LETTER_SIZES.indexOf(category === "bottom" ? buyer.bottom : buyer.top);
  return size.sizes.some((s) => Math.abs(LETTER_SIZES.indexOf(s) - theirs) <= LETTER_TOLERANCE);
}

// A typed size without a leading "Size", so it isn't shown twice.
export function sizeText(text: string): string {
  return text.trim().replace(/^size\b[:.]?\s*/i, "");
}

// How the item page shows a size: "Size M".
export function sizeLabel(text: string): string {
  return `Size ${sizeText(text)}`;
}
