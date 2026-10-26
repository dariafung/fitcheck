import { z } from "zod";
import { Category, GeneratedImage, MediaRef } from "./common";

export const PROMPT_VERSION = "render-outfit@1";

export const RenderOutfitInput = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        image: MediaRef,
        category: Category,
        description: z.string(),
      }),
    )
    .length(3),
});
export type RenderOutfitInput = z.input<typeof RenderOutfitInput>;

export const RenderOutfitOutput = z.object({
  image: GeneratedImage,
  prompt: z.string(),
});
export type RenderOutfitOutput = z.output<typeof RenderOutfitOutput>;
