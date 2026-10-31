// The product name as the item card shows it. The model is asked to write
// it this way; this catches what it leaves behind. Nothing else changes:
// no shortening, no rewording.
import { brandKey, brandKeys } from "./brands";

// ® ™ © ℠ next to a name ("Supima® Long Sleeve T-Shirt").
const MARKS = /[®™©℠]/g;
// A store's note at the end after an asterisk: "*Updated", "*Waist Length".
const MARKER = /\s+\*[^*]*$/;
// What may sit between a leading brand and the name: "Hollister - Hoodie".
const SEPARATOR = /^[-–—:|·]+$/;
// A collaboration ("adidas x Wales Bonner Samba") keeps its brand.
const COLLAB = /^[x×]$/i;
// The longest brand name looked for at the start, in words.
const MAX_BRAND_WORDS = 4;
// Kept lowercase in title case unless first.
const SMALL_WORDS = new Set(["a", "an", "and", "or", "the", "of", "with", "in", "on", "for", "to", "at", "by"]);

// The name without a leading brand, or as is when the brand is all there is
// or starts a collaboration. The longest match wins (A&F before Abercrombie).
function dropBrand(words: string[], brand: string | undefined): string[] {
  const keys = brandKeys(brand);
  if (keys.length === 0) return words;
  for (let n = Math.min(MAX_BRAND_WORDS, words.length - 1); n > 0; n--) {
    if (!keys.includes(brandKey(words.slice(0, n).join(" ")))) continue;
    let rest = n;
    while (rest < words.length && SEPARATOR.test(words[rest])) rest++;
    if (rest === words.length || COLLAB.test(words[rest])) return words;
    return words.slice(rest);
  }
  return words;
}

// One piece of an all-caps word (split at hyphens) in title case. Pieces
// with no vowel are taken for acronyms and stay as they are (ZW, TRF, XS).
function titlePiece(piece: string, first: boolean): string {
  const letters = piece.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 2 && !/[aeiouy]/i.test(letters)) return piece;
  const lower = piece.toLowerCase();
  if (!first && SMALL_WORDS.has(lower)) return lower;
  return lower.replace(/\p{L}/u, (c) => c.toUpperCase());
}

// "FAUX SUEDE BELTED JACKET" → "Faux Suede Belted Jacket",
// "V-NECK T-SHIRT" → "V-Neck T-Shirt", "WOMEN'S" → "Women's".
function titleCase(words: string[]): string[] {
  return words.map((word, w) =>
    word
      .split("-")
      .map((piece, p) => titlePiece(piece, w === 0 && p === 0))
      .join("-"),
  );
}

const isAllCaps = (text: string) => /\p{Lu}/u.test(text) && !/\p{Ll}/u.test(text);

// Drops marks and store notes, a leading brand (the brand has its own box),
// and turns an all-caps name into title case. Names with any lowercase
// letter keep their case.
export function cleanTitle(title: string, brand: string | undefined): string {
  const text = title.replace(MARKS, "").replace(MARKER, "").replace(/\s+/g, " ").trim();
  let words = dropBrand(text.split(" "), brand);
  if (isAllCaps(words.join(" "))) words = titleCase(words);
  return words.join(" ").trim() || title.trim();
}
