import type { z } from "zod";
import type { FeelingAspect } from "../schemas/common";
import type {
  ParseFeelingInput,
  ParseFeelingOutput,
} from "../schemas/parse-feeling";

const POSITIVE = /\b(love|flattering|slimming|comfy|comfortable|great)\b/i;
const NEGATIVE = /\b(hate|tight|itchy|unflattering|boxy|never wear)\b/i;

const ASPECT_WORDS: [RegExp, FeelingAspect["aspect"], FeelingAspect["sentiment"]][] = [
  [/\b(too short|too long)\b/i, "length", "negative"],
  [/\b(tight|boxy|baggy)\b/i, "fit", "negative"],
  [/\b(itchy|scratchy)\b/i, "feel", "negative"],
  [/\b(soft|comfy|comfortable)\b/i, "feel", "positive"],
];

function mockAspects(text: string): FeelingAspect[] {
  return ASPECT_WORDS.flatMap(([words, aspect, sentiment]) => {
    const said = text.match(words)?.[0].toLowerCase();
    return said ? [{ aspect, sentiment, said, means: said }] : [];
  });
}

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
    aspects: mockAspects(input.text),
    occasions: input.item.tags.occasions,
    mood: [],
    summary: input.text.slice(0, 120),
  };
}
