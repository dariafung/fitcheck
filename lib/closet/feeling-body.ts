import { z } from "zod";

// Same cap as the parseFeeling input. Safe to import from client code.
export const MAX_FEELING_LENGTH = 4000;

export const FeelingSource = z.enum(["typed", "voice"]);
export type FeelingSource = z.infer<typeof FeelingSource>;

export const FeelingBody = z.object({
  text: z.string().trim().min(1).max(MAX_FEELING_LENGTH),
  // "voice" when the text came, at least in part, from a recording.
  source: FeelingSource.default("typed"),
});
export type FeelingBody = z.infer<typeof FeelingBody>;
