import { z } from "zod";
import { ItemTags } from "@/lib/ai/schemas/common";
import { AskingPriceCents, Condition } from "@/lib/resale/listing";
import { MAX_ITEM_SIZE_LENGTH } from "@/lib/resale/size";

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

// What PATCH /api/items/[id] accepts: the details, the status, the size, the
// asking price (US cents) and condition, or any of them together. The size is
// as typed (M, 28, US 8); null or empty clears it, which an item on its way
// out can't do. Passing an item on also needs a price and a condition.
// Unknown keys are rejected so other fields are not silently ignored.
export const ItemPatch = z
  .strictObject({
    details: ItemDetails.optional(),
    status: ItemStatus.optional(),
    size: z
      .string()
      .trim()
      .max(MAX_ITEM_SIZE_LENGTH)
      .nullable()
      .transform((s) => s || null)
      .optional(),
    askingPriceCents: AskingPriceCents.nullable().optional(),
    condition: Condition.nullable().optional(),
  })
  .refine(
    (p) =>
      p.details !== undefined ||
      p.status !== undefined ||
      p.size !== undefined ||
      p.askingPriceCents !== undefined ||
      p.condition !== undefined,
    { message: "Send details, a status, a size, a price or a condition." },
  );
export type ItemPatch = z.infer<typeof ItemPatch>;
