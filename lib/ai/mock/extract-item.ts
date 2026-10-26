import type { z } from "zod";
import type {
  ExtractItemInput,
  ExtractItemOutput,
} from "../schemas/extract-item";
import { seededRandom } from "./random";

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
    tags: {
      colors: [{ name: "black" }],
      materials: ["cotton"],
      formality: 2,
      seasons: ["spring", "fall"],
      occasions: ["work", "social"],
      ...known,
      category: known.category ?? "top",
    },
    onModel: random() < 0.5,
    sources: [],
    lowConfidence: ["fit"],
  };
}
