import { z } from "zod";
import { GeneratedImage, MediaRef } from "./common";

export const PROMPT_VERSION = "segment-garment@2";

export const SegmentGarmentInput = z.object({
  image: MediaRef,
  // Category word naming the garment to keep, e.g. "jacket".
  category: z.string().min(1),
  // One line about the garment (describeItem), so the right one is kept.
  description: z.string().optional(),
});
export type SegmentGarmentInput = z.input<typeof SegmentGarmentInput>;

// The garment alone on a plain white background, no person.
export const SegmentGarmentOutput = z.object({
  image: GeneratedImage,
});
export type SegmentGarmentOutput = z.output<typeof SegmentGarmentOutput>;
