import type { z } from "zod";
import type {
  SegmentGarmentInput,
  SegmentGarmentOutput,
} from "../schemas/segment-garment";
import { BLANK_PNG_BASE64 } from "./random";

export function mockSegmentGarment(
  input: z.output<typeof SegmentGarmentInput>,
): z.input<typeof SegmentGarmentOutput> {
  void input;
  return { mask: { mime: "image/png", base64: BLANK_PNG_BASE64 } };
}
