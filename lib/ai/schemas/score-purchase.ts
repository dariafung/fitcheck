import { z } from "zod";
import { ProfileTopic } from "./build-profile";
import { FeelingStructured, ItemSummary, MediaRef, ProfileSummary } from "./common";

export const PROMPT_VERSION = "score-purchase@6";

// Each fit question is scored 0 to this, higher is better.
export const FIT_SCORE_MAX = 8;

// What the user said about an owned item, parsed from their own words.
export const FeltFeeling = FeelingStructured.pick({
  flattering: true,
  liked: true,
  aspects: true,
  mood: true,
  summary: true,
});
export type FeltFeeling = z.infer<typeof FeltFeeling>;

// At most this many felt items, the closest ones, go with a photo.
export const MAX_FELT_PHOTOS = 6;

// The verdicts live in the feeling, unflattened: "no" and "mixed" count too.
// A photo only when there is one; without it the item is text alone.
export const FeltItem = ItemSummary.omit({ flattering: true, liked: true }).extend({
  feeling: FeltFeeling,
  photo: MediaRef.optional(),
});
export type FeltItem = z.input<typeof FeltItem>;

// One line of the user's style card (P1-3): what suits them or what to skip,
// on one topic. Occasions aren't sent; they don't bear on the questions.
export const StyleLine = z.object({
  topic: ProfileTopic.exclude(["occasion"]),
  kind: z.enum(["suits", "avoid"]),
  text: z.string().min(1),
});
export type StyleLine = z.infer<typeof StyleLine>;

// The model judges one candidate against every owned item the user wrote a
// feeling about, good and bad. It scores each question 0-FIT_SCORE_MAX with a
// reason; lib/check adds the scores into the 0-100 match score and computes
// the gap metrics.
export const ScorePurchaseInput = z.object({
  candidate: ItemSummary.extend({ photo: MediaRef.optional() }),
  profile: ProfileSummary,
  feltItems: z.array(FeltItem),
  // Body areas of fit aspects the user felt bad about, across all feelings.
  troubleAreas: z.array(z.string()).default([]),
  // Left out entirely when the user has no usable card, so the request is
  // the same as before cards existed.
  styleProfile: z.array(StyleLine).min(1).optional(),
  questions: z
    .array(z.object({ id: z.string().min(1), text: z.string().min(1) }))
    .min(1)
    .max(8),
});
export type ScorePurchaseInput = z.input<typeof ScorePurchaseInput>;

// One answer per question, in the same order.
export const ScorePurchaseOutput = z.object({
  answers: z.array(
    z.object({ id: z.string(), score: z.int().min(0).max(FIT_SCORE_MAX), reason: z.string() }),
  ),
  summary: z.string(),
});
export type ScorePurchaseOutput = z.output<typeof ScorePurchaseOutput>;
