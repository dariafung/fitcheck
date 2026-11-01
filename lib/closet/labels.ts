// Names for item fields and their values, shared by the entry card (add,
// check, edit) and the item page, so one field reads the same everywhere.
// No server-only imports: the client bundles this file.
import type { Category, Occasion } from "@/lib/ai/schemas/common";

export const FIELD_LABELS = {
  category: "Type",
  fit: "Fit",
  colorFamily: "Main color",
  colors: "Colors",
  pattern: "Pattern",
  materials: "Materials",
  formality: "How dressy",
  tempRangeF: "Comfortable in",
  occasions: "Occasions",
} as const;

// In the order the entry card lists them.
export const CATEGORY_LABELS: [Category, string][] = [
  ["top", "Top"],
  ["bottom", "Bottom"],
  ["one_piece", "One-piece"],
  ["outerwear", "Outerwear"],
  ["shoes", "Shoes"],
  ["accessory", "Accessory"],
];

// What the closet takes: accessories can't be added (the buy check still
// takes them, to say so).
export const CLOTHING_LABELS = CATEGORY_LABELS.filter(([category]) => category !== "accessory");

// formality 1–5, in order.
export const FORMALITY_LABELS = ["Lounge", "Casual", "Smart casual", "Business", "Formal"] as const;

export function formalityLabel(formality: number): string {
  return FORMALITY_LABELS[formality - 1] ?? String(formality);
}

export function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Color names arrive as the store wrote them ("LIGHT HEATHER GREY", "black");
// shown in sentence case so they read alike ("Light heather grey", "Black").
export function sentenceCase(text: string): string {
  return capitalize(text.toLowerCase());
}

// The lifestyle mix's occasions, as the outfit calendar names them.
export const OCCASION_LABELS: Record<Occasion, string> = {
  work: "Work",
  school: "School",
  social: "Social",
  sport: "Sport",
  home: "Home",
};
