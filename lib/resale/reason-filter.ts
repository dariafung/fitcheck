// What a buyer may read about why a passing-on item suits them: their own
// buy check's summary and its best code reasons, minus anything that states
// body numbers or judges their body. Never shown to the seller.
import { NO_FIT_SUMMARY } from "@/lib/check/buy-check";

// Stands in for a summary that had nothing left after filtering.
export const FALLBACK_SUMMARY = "Here's how it fits with what you own.";

// Most sentences kept: the summary and two reasons.
export const MAX_BUYER_REASONS = 3;

// Whole words, any case. "flattering your" is a phrase, the rest single words.
export const JUDGY_WORDS = [
  "hide",
  "hides",
  "hiding",
  "conceal",
  "conceals",
  "camouflage",
  "camouflages",
  "disguise",
  "disguises",
  "slimming",
  "slims",
  "slimmer",
  "thinner",
  "minimize",
  "minimizes",
  "minimise",
  "minimises",
  "unflattering",
  "problem area",
  "problem areas",
  "trouble spot",
  "trouble spots",
  "flaws",
  "bulky",
  "fat",
  "heavy",
  "wide hips",
  "flattering your",
] as const;

const JUDGY = new RegExp(`\\b(?:${JUDGY_WORDS.map((w) => w.replace(" ", "\\s+")).join("|")})\\b`, "i");

// A height or weight: "165 cm", "58kg", "120 lbs", "5 ft", "5'5"", "5′5″".
// A lone 4" is an item's length, so it stays.
const BODY_NUMBER = /\d+(?:\.\d+)?\s*(?:cm|kg|kgs|lb|lbs|pounds|ft|feet|in|inches)\b|\d\s*['′]\s*\d{1,2}\b/i;

export function allowedSentence(sentence: string): boolean {
  return !JUDGY.test(sentence) && !BODY_NUMBER.test(sentence);
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function allowedText(text: string): string {
  return sentences(text).filter(allowedSentence).join(" ");
}

// The summary first (or the fallback), then each reason that survives whole.
export function buyerReasons(summary: string, reasons: readonly string[]): string[] {
  const kept = summary === NO_FIT_SUMMARY ? "" : allowedText(summary);
  const rest = reasons.filter((r) => sentences(r).every(allowedSentence));
  return [kept || FALLBACK_SUMMARY, ...rest].slice(0, MAX_BUYER_REASONS);
}
