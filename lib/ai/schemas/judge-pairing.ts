import { z } from "zod";
import { ItemSummary } from "./common";

export const PROMPT_VERSION = "judge-pairing@1";

export const MAX_PAIRS_PER_CALL = 20;

export const JudgePairingInput = z.object({
  pairs: z
    .array(z.object({ a: ItemSummary, b: ItemSummary }))
    .min(1)
    .max(MAX_PAIRS_PER_CALL),
});
export type JudgePairingInput = z.input<typeof JudgePairingInput>;

// One result per input pair, in the same order.
export const JudgePairingOutput = z.object({
  results: z.array(
    z.object({
      aId: z.uuid(),
      bId: z.uuid(),
      pairs: z.boolean(),
      reason: z.string(),
    }),
  ),
});
export type JudgePairingOutput = z.output<typeof JudgePairingOutput>;
