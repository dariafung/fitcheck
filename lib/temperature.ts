import { z } from "zod";

// Temperature range an item is comfortable in, in whole degrees Fahrenheit.
// Replaces seasons everywhere. extractItem estimates it from type and
// material; the user can edit it (stored in user_tags like other tags).
// Shared by every lane word for word: change it in one place.
export const TEMP_F_MIN = -20;
export const TEMP_F_MAX = 110;

export const TempRangeF = z
  .object({
    min: z.number().int().min(TEMP_F_MIN).max(TEMP_F_MAX),
    max: z.number().int().min(TEMP_F_MIN).max(TEMP_F_MAX),
  })
  .refine((r) => r.min <= r.max, { message: "min must be <= max" });

export type TempRangeF = z.infer<typeof TempRangeF>;

// Inclusive overlap of two ranges (e.g. an item against today's low/high).
export function rangesOverlap(a: TempRangeF, b: TempRangeF): boolean {
  return a.min <= b.max && b.min <= a.max;
}
