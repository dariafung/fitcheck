import { z } from "zod";
import { ItemTags } from "@/lib/ai/schemas/common";

// Worn (active) or on its way out (passing_on). Only active items count as
// owned in outfits, buy checks and Good for today.
export const ItemStatus = z.enum(["active", "passing_on"]);
export type ItemStatus = z.infer<typeof ItemStatus>;

// Everything the entry card edits, sent whole: name and brand go to their
// columns, tags are stored as the differences from the AI's (user_tags).
// Same limits as saving a new item.
export const ItemDetails = z.strictObject({
  title: z.string().trim().min(1).max(200),
  // Empty or null clears it.
  brand: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .transform((b) => b || null),
  tags: ItemTags,
});
export type ItemDetails = z.infer<typeof ItemDetails>;

// What PATCH /api/items/[id] accepts: the details, the status, or both.
// Unknown keys are rejected so other fields are not silently ignored.
export const ItemPatch = z
  .strictObject({
    details: ItemDetails.optional(),
    status: ItemStatus.optional(),
  })
  .refine((p) => p.details !== undefined || p.status !== undefined, {
    message: "Send details or a status.",
  });
export type ItemPatch = z.infer<typeof ItemPatch>;
