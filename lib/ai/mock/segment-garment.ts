import type { z } from "zod";
import type {
  SegmentGarmentInput,
  SegmentGarmentOutput,
} from "../schemas/segment-garment";
import { BLANK_PNG_BASE64 } from "./random";

// Hands an inline PNG back as it came, so the page still shows the item.
export function mockSegmentGarment(
  input: z.output<typeof SegmentGarmentInput>,
): z.input<typeof SegmentGarmentOutput> {
  const { image } = input;
  const base64 = image.kind === "inline" && image.mime === "image/png" ? image.base64 : BLANK_PNG_BASE64;
  return { image: { mime: "image/png", base64 } };
}
