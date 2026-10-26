import { z } from "zod";
import { GeneratedImage, MediaRef } from "./common";

export const PROMPT_VERSION = "segment-garment@1";

export const SegmentGarmentInput = z.object({
  image: MediaRef,
  // Category word used as the SAM prompt, e.g. "jacket".
  category: z.string().min(1),
});
export type SegmentGarmentInput = z.input<typeof SegmentGarmentInput>;

export const SegmentGarmentOutput = z.object({
  mask: GeneratedImage,
});
export type SegmentGarmentOutput = z.output<typeof SegmentGarmentOutput>;
