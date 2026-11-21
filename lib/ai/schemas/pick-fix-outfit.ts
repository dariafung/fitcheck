import { z } from "zod";
import { FeelingAspect, ItemSummary, MediaRef } from "./common";

export const PROMPT_VERSION = "pick-fix-outfit@1";

// Most other closet items one call lists.
export const MAX_FIX_ITEMS = 40;
// What the prompt asks for, and the most an answer may run to.
export const FIX_REASON_MAX_WORDS = 20;
export const FIX_REASON_WORD_LIMIT = 30;

// One bad thing the owner's note says about the piece.
export const FixComplaint = FeelingAspect.omit({ sentiment: true });
export type FixComplaint = z.infer<typeof FixComplaint>;

// An owned piece its owner is unhappy with (a written complaint, a low star
// rating, or both) and the other active pieces of the same closet it could
// be worn with, as text. Only the piece itself may come with a photo.
export const PickFixOutfitInput = z
  .object({
    item: ItemSummary.extend({ photo: MediaRef.optional() }),
    complaints: z.array(FixComplaint),
    // Rated 1 or 2 stars. With no complaint, the owner didn't say why.
    lowRating: z.boolean(),
    closet: z.array(ItemSummary).min(1).max(MAX_FIX_ITEMS),
  })
  .refine((i) => i.lowRating || i.complaints.length > 0, { message: "Needs a complaint or a low rating" });
export type PickFixOutfitInput = z.input<typeof PickFixOutfitInput>;

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export const PickFixOutfitOutput = z
  .object({
    // The closet items that make the outfit with the piece; empty when
    // nothing helps. Callers check that they do form a complete outfit.
    itemIds: z.array(z.uuid()),
    // Why that outfit; empty without a pick.
    reason: z.string(),
  })
  .refine((o) => o.itemIds.length === 0 || (wordCount(o.reason) > 0 && wordCount(o.reason) <= FIX_REASON_WORD_LIMIT), {
    message: "A pick needs a reason within the word limit",
    path: ["reason"],
  });
export type PickFixOutfitOutput = z.output<typeof PickFixOutfitOutput>;
