// A size as typed, read for comparing with other sizes of the same brand and
// type. Unlike resale matching (lib/resale/size.ts), nothing is converted
// between scales: a waist 27 and an S are never called the same size.
import type { Category } from "../ai/schemas/common";
import { sizeText } from "../resale/size";

export type Scale = "letter" | "number" | "waist" | "eu" | "shoe_us" | "shoe_eu" | "label";

export interface RankedSize {
  // How it reads in a sentence: S, 27, 7.5.
  label: string;
  scale: Scale;
  // Bigger is bigger, within one scale; null when it can only be told apart
  // from other sizes ("S/M", "One size").
  rank: number | null;
}

const LETTERS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const LETTER_ALIASES: Record<string, string> = {
  SMALL: "S",
  MEDIUM: "M",
  LARGE: "L",
  "X-SMALL": "XS",
  "X SMALL": "XS",
  "X-LARGE": "XL",
  "X LARGE": "XL",
  "2XL": "XXL",
  XXXL: "3XL",
};

const US_NUMBER_MAX = 22;
const WAIST_MIN = 23;
const WAIST_MAX = 44;
const SHOE_US_MAX = 16;
const SHOE_EU_MIN = 34;
const SHOE_EU_MAX = 47;

// Null when there is nothing left to read.
export function rankSize(text: string, category: Category): RankedSize | null {
  const cleaned = sizeText(text.normalize("NFKC")).toUpperCase().replace(/\s+/g, " ").trim();
  // "27 (US 4)" is a 27.
  const label = cleaned.replace(/ ?\([^)]*\)/g, "").trim() || cleaned;
  if (!label) return null;

  const letter = LETTER_ALIASES[label] ?? label;
  const at = LETTERS.indexOf(letter);
  if (at >= 0) return { label: letter, scale: "letter", rank: at };

  if (category === "shoes") {
    const shoe = label.match(/^(?:(US|EU) ?)?(\d{1,2}(?:\.5)?)$/);
    if (shoe) {
      const n = Number(shoe[2]);
      if (shoe[1] !== "EU" && n > 0 && n <= SHOE_US_MAX) return { label: shoe[2], scale: "shoe_us", rank: n };
      if (shoe[1] !== "US" && n >= SHOE_EU_MIN && n <= SHOE_EU_MAX) return { label, scale: "shoe_eu", rank: n };
    }
    return { label, scale: "label", rank: null };
  }

  const eu = label.match(/^EU ?(\d{2})$/);
  if (eu) return { label, scale: "eu", rank: Number(eu[1]) };

  const us = label.match(/^(?:US ?)?(00|\d{1,2})$/);
  if (us && Number(us[1]) <= US_NUMBER_MAX) {
    return { label: us[1], scale: "number", rank: us[1] === "00" ? -1 : Number(us[1]) };
  }

  if (category === "bottom") {
    // 27, W27, 27W. A waist with a length (27x32) is its own label: two
    // lengths of one waist are different sizes.
    const waist = label.match(/^W?(\d{2})W?$/);
    const n = waist ? Number(waist[1]) : 0;
    if (n >= WAIST_MIN && n <= WAIST_MAX) return { label: String(n), scale: "waist", rank: n };
  }
  return { label, scale: "label", rank: null };
}
