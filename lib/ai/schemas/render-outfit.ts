import { z } from "zod";
import { Category, GeneratedImage, MediaRef } from "./common";

export const PROMPT_VERSION = "render-outfit@2";

// One outfit: 2 pieces (one-piece + shoes) up to 4 (with a layer), in the
// order they should be described to the model.
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
    .min(2)
    .max(4),
});
export type RenderOutfitInput = z.input<typeof RenderOutfitInput>;

// The whole outfit drawn as one flat-lay board on white, no person.
export const RenderOutfitOutput = z.object({
  image: GeneratedImage,
  prompt: z.string(),
});
export type RenderOutfitOutput = z.output<typeof RenderOutfitOutput>;
