// Request and response shapes shared by the add page and its Route Handlers.
// No server-only imports here: the client bundles this file.
import { z } from "zod";
import { ItemTags } from "@/lib/ai/schemas/common";

const WebSource = z.object({ field: z.string(), url: z.url() });

// What the extract step hands the page: an editable card plus what the save
// step needs to store alongside it.
export const ItemDraft = z.object({
  title: z.string().min(1),
  brand: z.string().optional(),
  priceCents: z.int().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  tags: ItemTags,
  onModel: z.boolean(),
  // Field names the model is unsure of; "image" when the photo is the whole screenshot.
  lowConfidence: z.array(z.string()),
  webSources: z.array(WebSource),
  imagePaths: z.array(z.string()).max(3),
  imageUrls: z.array(z.string()).max(3),
  rawSource: z.record(z.string(), z.unknown()),
});
export type ItemDraft = z.infer<typeof ItemDraft>;

export const SaveItemRequest = z.object({
  entryMethod: z.literal("screenshot"),
  title: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120).optional(),
  priceCents: z.int().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  imagePaths: z.array(z.string()).max(3),
  // The model's tags as extracted, and the tags after the user's edits.
  aiTags: ItemTags,
  tags: ItemTags,
  onModel: z.boolean(),
  rawSource: z.record(z.string(), z.unknown()),
});
export type SaveItemRequest = z.infer<typeof SaveItemRequest>;

// Expected outcomes of an upload; the extract route answers them with 200.
export type EntryErrorCode = "no_file" | "not_image" | "too_large" | "too_small" | "unrecognized" | "accessory";
