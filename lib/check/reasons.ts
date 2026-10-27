// Result-page copy for the parts computed in code. Same numbers, same words.
import type { Category, Occasion } from "../ai/schemas/common";
import type { DuplicateTier, MissingSlot, OccasionChange, OccasionGapTier } from "./gaps";

const PLURAL: Record<Category, string> = {
  top: "tops",
  bottom: "bottoms",
  one_piece: "one-pieces",
  shoes: "shoes",
  outerwear: "jackets",
  accessory: "accessories",
};

const OCCASION: Record<Occasion, string> = {
  work: "Work",
  school: "School",
  social: "Social",
  sport: "Sport",
  home: "Home",
};

function list(words: string[]): string {
  return words.length <= 1
    ? (words[0] ?? "")
    : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export function suitsYouReason(answers: { answer: boolean | null }[]): string {
  const asked = answers.filter((a) => a.answer !== null);
  if (asked.length === 0) return "Not enough to go on yet.";
  return `Yes to ${asked.filter((a) => a.answer).length} of ${asked.length}.`;
}

export function outfitsReason(count: number): string {
  if (count === 0) return "Doesn't make an outfit with your closet yet.";
  return `Makes ${count} outfit${count === 1 ? "" : "s"} with your closet.`;
}

export function revivesReason(titles: string[]): string {
  if (titles.length === 0) return "Doesn't bring back anything you can't wear now.";
  const n = titles.length;
  return `Brings back ${n} piece${n === 1 ? "" : "s"} you couldn't wear: ${list(titles)}.`;
}

export const NO_LIFESTYLE_REASON = "Set how many outfits you want in Profile to score this.";

// Most short occasions named in one reason.
const MAX_SHORT_NAMED = 2;

export function fillsGapReason(
  tier: OccasionGapTier,
  occasions: OccasionChange[],
  hasLifestyle: boolean,
): string {
  if (!hasLifestyle) return NO_LIFESTYLE_REASON;
  if (tier === "none") return "Doesn't add outfits for any occasion.";
  if (tier === "already_enough") {
    const [best] = occasions;
    const n = best.after - best.before;
    return `Adds ${n} for ${best.occasion}, but you already have enough.`;
  }
  return occasions
    .filter((o) => o.tier === "from_zero" || o.tier === "more_outfits")
    .slice(0, MAX_SHORT_NAMED)
    .map((o) => `${OCCASION[o.occasion]}: ${o.wanted - o.before} short, this adds ${o.after - o.before}.`)
    .join(" ");
}

export function notRepeatReason(tier: DuplicateTier, title: string | null): string {
  if (tier === "near_identical") return `Almost the same as your ${title}.`;
  if (tier === "similar") return `A lot like your ${title}.`;
  return "Nothing quite like it in your closet.";
}

// Shown when the candidate forms no outfit at all.
export function gapReason(slots: MissingSlot[]): string {
  if (slots.length === 0) return "Creates a gap: the pieces that go with it don't go together.";
  const none = slots.filter((s) => !s.owned).map((s) => PLURAL[s.category]);
  const unmatched = slots.filter((s) => s.owned).map((s) => PLURAL[s.category]);
  const parts = [
    ...(none.length > 0 ? [`you have no ${list(none)}`] : []),
    ...(unmatched.length > 0 ? [`none of your ${list(unmatched)} go with it`] : []),
  ];
  return `Creates a gap: ${parts.join(", and ")}.`;
}

export const ACCESSORY_NOTICE = "Accessories aren't supported yet. Try clothes or shoes.";
