import type { z } from "zod";
import type {
  RenderOutfitInput,
  RenderOutfitOutput,
} from "../schemas/render-outfit";
import { BLANK_PNG_BASE64 } from "./random";

export function mockRenderOutfit(
  input: z.output<typeof RenderOutfitInput>,
): z.input<typeof RenderOutfitOutput> {
  return {
    image: { mime: "image/png", base64: BLANK_PNG_BASE64 },
    prompt: `Mock flat-lay of ${input.items.map((i) => i.description).join(", ")}`,
  };
}
