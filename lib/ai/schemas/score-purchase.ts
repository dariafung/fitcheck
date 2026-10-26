import { z } from "zod";
import { Category, ItemSummary, ProfileSummary } from "./common";

export const PROMPT_VERSION = "score-purchase@1";

// The model judges one candidate against the items the user marked as
// flattering or liked. It answers yes/no questions with reasons and never
// produces a score: the 0-100 match score is computed in lib/check.
export const ScorePurchaseInput = z.object({
  candidate: ItemSummary,
  profile: ProfileSummary,
  anchors: z.array(ItemSummary),
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

// Computed by code, not the model; stored in purchase_checks.gap_result.
// Tier boundaries live in lib/check.
export const GapMetrics = z.object({
  newOutfitCount: z.int().nonnegative(),
  // Owned items that formed 0 outfits before and at least 1 with the candidate.
  revivedCount: z.int().nonnegative(),
  // Frequent occasions = the top one or two in the lifestyle mix.
  occasionGap: z.enum(["none", "already_enough", "more_outfits", "from_zero"]),
  duplicate: z.enum(["none", "similar", "near_identical"]),
  duplicateOfItemId: z.uuid().nullable(),
  // Set when the candidate forms no outfit at all.
  missingSlot: Category.nullable(),
});
export type GapMetrics = z.infer<typeof GapMetrics>;
