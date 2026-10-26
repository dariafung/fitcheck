import { z } from "zod";
import { FeelingStructured, ItemSummary } from "./common";

export const PROMPT_VERSION = "build-profile@1";

export const BuildProfileInput = z.object({
  items: z.array(ItemSummary).min(1),
  feelings: z.array(FeelingStructured.extend({ itemId: z.uuid() })),
});
export type BuildProfileInput = z.input<typeof BuildProfileInput>;

// Every statement must trace back to specific items.
const Statement = z.object({
  text: z.string(),
  evidenceItemIds: z.array(z.uuid()).min(1),
});

export const BuildProfileOutput = z.object({
  suits: z.array(Statement),
  avoid: z.array(Statement),
  frequentOccasions: z.array(z.string()),
});
export type BuildProfileOutput = z.output<typeof BuildProfileOutput>;
