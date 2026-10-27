import { z } from "zod";
import { FeelingStructured, ItemSummary, ProfileSummary } from "./common";

export const PROMPT_VERSION = "score-purchase@3";

// What the user said about an owned item, parsed from their own words.
export const FeltFeeling = FeelingStructured.pick({
  flattering: true,
  liked: true,
  aspects: true,
  mood: true,
  summary: true,
});
export type FeltFeeling = z.infer<typeof FeltFeeling>;

// The verdicts live in the feeling, unflattened: "no" and "mixed" count too.
export const FeltItem = ItemSummary.omit({ flattering: true, liked: true }).extend({
  feeling: FeltFeeling,
});
export type FeltItem = z.input<typeof FeltItem>;

// The model judges one candidate against every owned item the user wrote a
// feeling about, good and bad. It answers yes/no questions with reasons and
// never produces a score: the 0-100 match score and the gap metrics are
// computed in lib/check.
export const ScorePurchaseInput = z.object({
  candidate: ItemSummary,
  profile: ProfileSummary,
  feltItems: z.array(FeltItem),
  // Body areas of fit aspects the user felt bad about, across all feelings.
  troubleAreas: z.array(z.string()).default([]),
  questions: z
    .array(z.object({ id: z.string().min(1), text: z.string().min(1) }))
    .min(1)
    .max(8),
});
export type ScorePurchaseInput = z.input<typeof ScorePurchaseInput>;

// One answer per question, in the same order.
export const ScorePurchaseOutput = z.object({
  answers: z.array(
    z.object({ id: z.string(), answer: z.boolean(), reason: z.string() }),
  ),
  summary: z.string(),
});
export type ScorePurchaseOutput = z.output<typeof ScorePurchaseOutput>;
