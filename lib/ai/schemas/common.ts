import { z } from "zod";

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

export const Season = z.enum(["spring", "summer", "fall", "winter"]);
export const Occasion = z.enum(["work", "social", "sport", "home"]);
export type Occasion = z.infer<typeof Occasion>;
export const Fit = z.enum(["slim", "regular", "relaxed", "oversized"]);

export const ItemTags = z.object({
  category: Category,
  subcategory: z.string().optional(),
  colors: z.array(z.object({ name: z.string(), hex: z.string().optional() })),
  pattern: z.string().optional(),
  materials: z.array(z.string()),
  fit: Fit.optional(),
  formality: z.int().min(1).max(5),
  seasons: z.array(Season),
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

// Percentages per occasion; the profile form keeps them summing to 100.
export const LifestyleMix = z.object({
  work: z.number().min(0).max(100),
  social: z.number().min(0).max(100),
  sport: z.number().min(0).max(100),
  home: z.number().min(0).max(100),
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
