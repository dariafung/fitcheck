import type { z } from "zod";
import type {
  ExtractItemInput,
  ExtractItemOutput,
} from "../schemas/extract-item";
import type { Category } from "../schemas/common";
import { seededRandom } from "./random";

// Plausible comfortable ranges (°F) by type.
const TEMP_RANGE_F: Record<Category, { min: number; max: number }> = {
  top: { min: 50, max: 85 },
  bottom: { min: 40, max: 85 },
  one_piece: { min: 55, max: 90 },
  outerwear: { min: 20, max: 60 },
  shoes: { min: 30, max: 90 },
  accessory: { min: 30, max: 90 },
};

export function mockExtractItem(
  input: z.output<typeof ExtractItemInput>,
  seed: string,
): z.input<typeof ExtractItemOutput> {
  const random = seededRandom(seed);
  const { title, brand, priceCents, currency, ...known } = input.knownFields;
  return {
    title: title ?? "Mock item",
    brand,
    priceCents,
    currency,
    size: "S",
    tags: {
      colors: [{ name: "black" }],
      materials: ["cotton"],
      formality: 2,
      occasions: ["work", "social"],
      ...known,
      category: known.category ?? "top",
      colorFamily: known.colorFamily ?? "black",
      tempRangeF: known.tempRangeF ?? TEMP_RANGE_F[known.category ?? "top"],
    },
    onModel: random() < 0.5,
    sources: [],
    lowConfidence: ["fit"],
    recognized: true,
    productBox: input.screenshot
      ? { x: 0.1, y: 0.12, width: 0.8, height: 0.5 }
      : undefined,
  };
}
