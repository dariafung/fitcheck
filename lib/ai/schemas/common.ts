import { z } from "zod";
import { COLOR_FAMILIES } from "@/lib/color-families";
import { TempRangeF } from "@/lib/temperature";

// An image or audio file passed to a model. Inline data is hashed by content
// for replay keys, never stored whole.
export const MediaRef = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.url() }),
  z.object({ kind: z.literal("storage"), path: z.string().min(1) }),
  z.object({
    kind: z.literal("inline"),
    mime: z.string().min(1),
    base64: z.string().min(1),
  }),
]);
export type MediaRef = z.infer<typeof MediaRef>;

export const Category = z.enum([
  "top",
  "bottom",
  "one_piece",
  "shoes",
  "outerwear",
  "accessory",
]);
export type Category = z.infer<typeof Category>;

export const Occasion = z.enum(["work", "school", "social", "sport", "home"]);
export type Occasion = z.infer<typeof Occasion>;
export const Fit = z.enum(["slim", "regular", "relaxed", "oversized"]);

export const ItemTags = z.object({
  category: Category,
  subcategory: z.string().optional(),
  colors: z.array(z.object({ name: z.string(), hex: z.string().optional() })),
  // One family from the shared list, for swatches and pairing color rules;
  // `colors` keeps the store's own names.
  colorFamily: z.enum(COLOR_FAMILIES).optional(),
  pattern: z.string().optional(),
  materials: z.array(z.string()),
  fit: Fit.optional(),
  formality: z.int().min(1).max(5),
  // Comfortable temperatures in °F; replaces seasons.
  tempRangeF: TempRangeF.optional(),
  occasions: z.array(Occasion),
  notes: z.string().optional(),
});
export type ItemTags = z.infer<typeof ItemTags>;

// What the model sees about an owned or candidate item.
export const ItemSummary = z.object({
  id: z.uuid(),
  title: z.string(),
  tags: ItemTags,
  flattering: z.boolean().optional(),
  liked: z.boolean().optional(),
});
export type ItemSummary = z.infer<typeof ItemSummary>;

export const Verdict = z.enum(["yes", "no", "mixed", "unknown"]);

export const FeelingStructured = z.object({
  flattering: Verdict,
  liked: Verdict,
  bodyAreas: z.array(
    z.object({
      area: z.string(),
      sentiment: z.enum(["positive", "negative", "neutral"]),
    }),
  ),
  occasions: z.array(z.string()),
  mood: z.array(z.string()),
  summary: z.string(),
});
export type FeelingStructured = z.infer<typeof FeelingStructured>;

// Most different outfits one occasion can want in a season.
export const MAX_OUTFITS_WANTED = 30;

const OutfitsWanted = z.int().min(0).max(MAX_OUTFITS_WANTED);

// How many different outfits the user wants per season for each occasion.
export const LifestyleMix = z.object({
  work: OutfitsWanted,
  school: OutfitsWanted,
  social: OutfitsWanted,
  sport: OutfitsWanted,
  home: OutfitsWanted,
});
export type LifestyleMix = z.infer<typeof LifestyleMix>;

export const ProfileSummary = z.object({
  bodyShape: z.string().optional(),
  heightCm: z.number().positive().optional(),
  lifestyleMix: LifestyleMix,
});
export type ProfileSummary = z.infer<typeof ProfileSummary>;

export const GeneratedImage = z.object({
  mime: z.literal("image/png"),
  base64: z.string().min(1),
});
