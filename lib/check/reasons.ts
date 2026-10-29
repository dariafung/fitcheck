// Result-page copy for the parts computed in code. Same numbers, same words.
import type { Category, Occasion } from "../ai/schemas/common";
import { SLOTS_NEEDED, type GapKind, type MissingSlot, type OccasionChange, type OccasionGapTier } from "./gaps";
import { NO_DATA_POINTS, POINTS_PER_QUESTION } from "./score";

const PLURAL: Record<Category, string> = {
  top: "tops",
  bottom: "bottoms",
  one_piece: "one-pieces",
  shoes: "shoes",
  outerwear: "jackets",
  accessory: "accessories",
};

// Mid-sentence: "3 work outfits".
const OCCASION: Record<Occasion, string> = {
  work: "work",
  school: "school",
  social: "social",
  sport: "sport",
  home: "home",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function list(words: string[], last = "and"): string {
  return words.length <= 1
    ? (words[0] ?? "")
    : `${words.slice(0, -1).join(", ")} ${last} ${words[words.length - 1]}`;
}

// What each fit question looks at, for "no notes to compare on color".
const FIT_TOPIC: Record<string, string> = {
  cut_flatters: "cut",
  spares_trouble_areas: "the spots you're unsure about",
  color_liked: "color",
  style_liked: "style",
  feel_liked: "feel",
};

export const DEFAULT_FIT_SCORE = `${NO_DATA_POINTS}/${POINTS_PER_QUESTION}`;

// Shown in Why for a question that wasn't asked.
export const NO_NOTES_ANSWER = "Default score: no notes to compare yet.";

export function suitsYouReason(answers: { id: string; score: number | null }[]): string {
  const unasked = answers.filter((a) => a.score === null);
  if (unasked.length === answers.length) {
    return `No notes on your clothes to compare yet, so every question gets the default ${DEFAULT_FIT_SCORE}.`;
  }
  if (unasked.length === 0) return "Scored on what you said about your clothes.";
  const topics = list(unasked.map((a) => FIT_TOPIC[a.id] ?? a.id));
  const those = unasked.length === 1 ? "it gets" : "those get";
  return `No notes to compare on ${topics} yet, so ${those} the default ${DEFAULT_FIT_SCORE}.`;
}

export function outfitsReason(count: number): string {
  if (count === 0) return "Doesn't make an outfit with your closet yet.";
  return `Makes ${plural(count, "outfit")} with your closet.`;
}

// Revived: owned pieces that had no complete outfit before and now have one.
export function revivesReason(titles: string[]): string {
  if (titles.length === 0) return "Doesn't give an outfit to anything that had none.";
  const n = titles.length;
  return n === 1
    ? `1 piece that had no outfit now has one: ${titles[0]}.`
    : `${n} pieces that had no outfit now have one: ${list(titles)}.`;
}

// The fills-a-gap reason without a lifestyle mix; the page links "Profile"
// to the outfits section.
export const NO_LIFESTYLE_PARTS = ["Set how many outfits you want in ", "Profile", " to score this."] as const;
export const NO_LIFESTYLE_REASON = NO_LIFESTYLE_PARTS.join("");
export const PROFILE_MIX_HREF = "/profile#mix-heading";

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
    return `Adds ${plural(n, `${OCCASION[best.occasion]} outfit`)}, but you already have enough.`;
  }
  return occasions
    .filter((o) => o.tier === "from_zero" || o.tier === "more_outfits")
    .slice(0, MAX_SHORT_NAMED)
    .map(
      (o) =>
        `You want ${plural(o.wanted, `${OCCASION[o.occasion]} outfit`)} and have ${o.before}. This adds ${o.after - o.before}.`,
    )
    .join(" ");
}

// Not a repeat, when there's nothing in the closet to ask the model about.
export const EMPTY_CLOSET_REPEAT_REASON = "Nothing in your closet to repeat.";

const SINGULAR: Record<Category, string> = {
  top: "top",
  bottom: "bottom",
  one_piece: "one-piece",
  shoes: "shoes",
  outerwear: "jacket",
  accessory: "accessory",
};

// "a top and bottom", "shoes", "a one-piece and shoes".
function toAdd(slots: MissingSlot[]): string {
  const words = list(slots.map((s) => SINGULAR[s.category]));
  return slots[0].category === "shoes" ? words : `a ${words}`;
}

function whatsMissing(slots: MissingSlot[]): string {
  const none = slots.filter((s) => !s.owned).map((s) => PLURAL[s.category]);
  const unmatched = slots.filter((s) => s.owned).map((s) => PLURAL[s.category]);
  return [
    ...(none.length > 0 ? [`you have no ${list(none)}`] : []),
    ...(unmatched.length > 0 ? [`none of your ${list(unmatched)} go with it`] : []),
  ].join(", and ");
}

const sameSlots = (a: MissingSlot[], b: MissingSlot[]) =>
  a.length === b.length && a.every((s, i) => s.category === b[i].category);

// The slots of an option's outfit that something owned already goes with.
// Null when the option fits more than one way to build the outfit (a jacket
// missing only shoes: it could have a top and bottom, or a one-piece).
function coveredSlots(missing: MissingSlot[], candidate: Category): Category[] | null {
  if (candidate === "accessory") return [];
  const ways = SLOTS_NEEDED[candidate].filter((way) => missing.every((s) => way.includes(s.category)));
  if (ways.length !== 1) return null;
  return ways[0].filter((slot) => !missing.some((s) => s.category === slot));
}

// Shown when the candidate forms no outfit at all; `options` holds the
// missing slots of each way to build an outfit around it.
export function gapReason(options: MissingSlot[][], kind: GapKind, candidate: Category): string {
  if (options.length === 0) return "Creates a gap: the pieces that go with it don't go together.";
  const unique = options.filter((o, i) => !options.slice(0, i).some((p) => sameSlots(o, p)));
  const it = candidate === "shoes" ? "these" : "this";
  if (kind === "nothing_owned") {
    const add = `Add ${unique.map(toAdd).join(", or ")}.`;
    const covered = unique.map((o) => coveredSlots(o, candidate));
    const have = [...new Set(covered.flatMap((c) => c ?? []))];
    if (have.length === 0 && covered.every((c) => c !== null)) {
      return `Nothing in your closet to wear ${it} with yet. ${add}`;
    }
    const yours = have.length > 0 ? `Your ${list(have.map((c) => PLURAL[c]))}` : "Some of your clothes";
    const none = [...new Set(unique.flat().map((s) => s.category))].map((c) => PLURAL[c]);
    const sentence = `${yours} could go with ${it}, but you have no ${list(none, "or")} yet.`;
    // One missing piece per option already says what to add.
    return unique.every((o) => o.length === 1) ? sentence : `${sentence} ${add}`;
  }
  return `Creates a gap: ${unique.map(whatsMissing).join(", or ")}.`;
}

export const ACCESSORY_NOTICE = "Accessories aren't supported yet. Try clothes or shoes.";

// Sent with a 200 when the model never finished scoring; the page offers to
// try again.
export const INCOMPLETE_ERROR = "incomplete";
export const INCOMPLETE_NOTICE = "The AI didn't finish this time.";
