import { z } from "zod";
import { ItemTags, MediaRef } from "./common";

export const PROMPT_VERSION = "extract-item@1";

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
  tags: ItemTags,
  onModel: z.boolean(),
  sources: z.array(z.object({ field: z.string(), url: z.url() })),
  lowConfidence: z.array(z.string()),
});
export type ExtractItemOutput = z.output<typeof ExtractItemOutput>;
