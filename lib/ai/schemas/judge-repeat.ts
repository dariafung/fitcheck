import { z } from "zod";
import { ItemSummary } from "./common";

export const PROMPT_VERSION = "judge-repeat@1";

// 10: nothing like it in the closet; 0: they own practically the same thing.
export const REPEAT_SCORE_MAX = 10;

// How much one candidate repeats what's already in the closet (active items).
// The candidate is never stored or cached, so every check asks again.
export const JudgeRepeatInput = z.object({
  candidate: ItemSummary,
  closet: z.array(ItemSummary).min(1),
});
export type JudgeRepeatInput = z.input<typeof JudgeRepeatInput>;

export const JudgeRepeatOutput = z.object({
  score: z.int().min(0).max(REPEAT_SCORE_MAX),
  // The most similar owned item; null when nothing comes close.
  closestId: z.uuid().nullable(),
  reason: z.string(),
});
export type JudgeRepeatOutput = z.output<typeof JudgeRepeatOutput>;
