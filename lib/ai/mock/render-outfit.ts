import type { z } from "zod";
import type {
  RenderOutfitInput,
  RenderOutfitOutput,
} from "../schemas/render-outfit";

// A 4:5 light grey card, so the page visibly swaps the board for "a picture".
const MOCK_BOARD_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAFCAIAAADtz9qMAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWN48uQBHDGQwQEAv3s1IfMsiJYAAAAASUVORK5CYII=";

export function mockRenderOutfit(
  input: z.output<typeof RenderOutfitInput>,
): z.input<typeof RenderOutfitOutput> {
  return {
    image: { mime: "image/png", base64: MOCK_BOARD_PNG_BASE64 },
    prompt: `Mock flat-lay of ${input.items.map((i) => i.description).join(", ")}`,
  };
}
