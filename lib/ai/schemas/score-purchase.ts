import { z } from "zod";
import { FeelingStructured, ItemSummary, ProfileSummary } from "./common";

export const PROMPT_VERSION = "score-purchase@3";

// What the user said about an anchor, parsed from their own words.
export const AnchorFeeling = FeelingStructured.pick({
  aspects: true,
  mood: true,
  summary: true,
});
export type AnchorFeeling = z.infer<typeof AnchorFeeling>;

export const Anchor = ItemSummary.extend({ feeling: AnchorFeeling.optional() });
export type Anchor = z.input<typeof Anchor>;

// The model judges one candidate against the items the user marked as
// flattering or liked. It answers yes/no questions with reasons and never
// produces a score: the 0-100 match score and the gap metrics are computed
// in lib/check.
export const ScorePurchaseInput = z.object({
  candidate: ItemSummary,
  profile: ProfileSummary,
  anchors: z.array(Anchor),
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
