import { z } from "zod";

// Same cap as the parseFeeling input. Safe to import from client code.
export const MAX_FEELING_LENGTH = 4000;

export const FeelingBody = z.object({
  text: z.string().trim().min(1).max(MAX_FEELING_LENGTH),
});
export type FeelingBody = z.infer<typeof FeelingBody>;
