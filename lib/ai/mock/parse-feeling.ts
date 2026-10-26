import type { z } from "zod";
import type {
  ParseFeelingInput,
  ParseFeelingOutput,
} from "../schemas/parse-feeling";

const POSITIVE = /\b(love|flattering|slimming|comfy|comfortable|great)\b/i;
const NEGATIVE = /\b(hate|tight|itchy|unflattering|boxy|never wear)\b/i;

// Keyword rules, just enough for the UI to show different results.
export function mockParseFeeling(
  input: z.output<typeof ParseFeelingInput>,
): z.input<typeof ParseFeelingOutput> {
  const positive = POSITIVE.test(input.text);
  const negative = NEGATIVE.test(input.text);
  const verdict =
    positive && negative ? "mixed" : positive ? "yes" : negative ? "no" : "unknown";
  return {
    flattering: verdict,
    liked: verdict,
    bodyAreas: [],
    occasions: input.item.tags.occasions,
    mood: [],
    summary: input.text.slice(0, 120),
  };
}
