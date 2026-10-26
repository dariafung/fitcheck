import { z } from "zod";
import { TempRangeF } from "@/lib/temperature";

// What PATCH /api/items/[id] accepts. Only the comfortable temperature range
// for now; unknown keys are rejected so other fields are not silently ignored.
export const ItemPatch = z.strictObject({
  tempRangeF: TempRangeF,
});
export type ItemPatch = z.infer<typeof ItemPatch>;
