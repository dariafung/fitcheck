import { z } from "zod";
import { COLOR_FAMILIES } from "@/lib/color-families";
import { MAX_ITEM_SIZE_LENGTH } from "@/lib/resale/size";
import { TempRangeF } from "@/lib/temperature";
import { ItemTags, MediaRef } from "./common";

export const PROMPT_VERSION = "extract-item@7";

export const ExtractItemInput = z.object({
  sourceUrl: z.url().optional(),
  // Fields already found by code (Shopify JSON, JSON-LD, ...); the model treats them as facts.
  knownFields: ItemTags.partial().extend({
    title: z.string().optional(),
    brand: z.string().optional(),
    priceCents: z.int().nonnegative().optional(),
    currency: z.string().optional(),
  }),
  pageText: z.string().optional(),
  embeddedJson: z.string().optional(),
  images: z.array(MediaRef).max(3),
  screenshot: MediaRef.optional(),
  allowWebSearch: z.boolean(),
});
export type ExtractItemInput = z.input<typeof ExtractItemInput>;

export const ExtractItemOutput = z.object({
  title: z.string().min(1),
  brand: z.string().optional(),
  priceCents: z.int().nonnegative().optional(),
  currency: z.string().optional(),
  // The size chosen on the screenshot, as written (S, 27, 7.5); none when
  // it shows no choice.
  size: z.string().trim().min(1).max(MAX_ITEM_SIZE_LENGTH).optional(),
  // Extraction always gives a color family and a temperature range (estimated
  // from type and material); older items may lack them.
  tags: ItemTags.extend({ colorFamily: z.enum(COLOR_FAMILIES), tempRangeF: TempRangeF }),
  onModel: z.boolean(),
  sources: z.array(z.object({ field: z.string(), url: z.url() })),
  lowConfidence: z.array(z.string()),
  // False when the input shows no product the model can identify.
  recognized: z.boolean().default(true),
  // Where the product photo sits in the screenshot, as fractions of its width
  // and height from the top-left corner. Left loose on purpose: code checks
  // it and falls back to the whole screenshot when it is off.
  productBox: z
    .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
    .optional(),
});
export type ExtractItemOutput = z.output<typeof ExtractItemOutput>;
