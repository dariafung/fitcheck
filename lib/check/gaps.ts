// Gap metrics for one candidate, from the closet's outfits before and after
// adding it. Pure code; values are exported so they can be tuned in testing.
import { Occasion, type Category, type LifestyleMix } from "../ai/schemas/common";
import { CANDIDATE_ITEM_ID } from "./pairings";
import { MAX_POINTS, occasionPoints } from "./score";
import { categoryOf, type ClosetItem, type Compatible } from "./types";

// Ordered from no help to the most help: adds no outfit to an occasion the
// user wants outfits for / adds some where there were already enough / adds
// some where the user is short / gives an occasion its first outfit.
export const OCCASION_GAP_TIERS = [
  "none",
  "already_enough",
  "more_outfits",
  "from_zero",
] as const;
export type OccasionGapTier = (typeof OCCASION_GAP_TIERS)[number];

export interface OccasionChange {
  occasion: Occasion;
  before: number;
  after: number;
  // Outfits the user wants for this occasion per season.
  wanted: number;
  tier: OccasionGapTier;
  points: number;
}

// An occasion the user wants no outfits for never counts.
export function occasionTier(before: number, after: number, wanted: number): OccasionGapTier {
  if (wanted === 0 || after <= before) return "none";
  if (before >= wanted) return "already_enough";
  return before === 0 ? "from_zero" : "more_outfits";
}

const rank = (tier: OccasionGapTier) => OCCASION_GAP_TIERS.indexOf(tier);

// Every occasion the candidate adds outfits to, most points first (then best
// tier; ties keep the Occasion order). The part takes the best tier and the
// occasions' points added up, capped. Without a lifestyle mix nothing counts.
export function occasionGap(
  mix: LifestyleMix | null,
  before: Record<Occasion, number>,
  after: Record<Occasion, number>,
): { tier: OccasionGapTier; points: number; occasions: OccasionChange[] } {
  if (!mix) return { tier: "none", points: 0, occasions: [] };
  const occasions = Occasion.options
    .map((occasion) => {
      const change = { occasion, before: before[occasion], after: after[occasion], wanted: mix[occasion] };
      const tier = occasionTier(change.before, change.after, change.wanted);
      return { ...change, tier, points: occasionPoints(change.before, change.after, change.wanted) };
    })
    .filter((o) => o.tier !== "none")
    .sort((a, b) => b.points - a.points || rank(b.tier) - rank(a.tier));
  const tier = occasions.reduce<OccasionGapTier>((best, o) => (rank(o.tier) > rank(best) ? o.tier : best), "none");
  const points = Math.min(MAX_POINTS.fillsGap, occasions.reduce((sum, o) => sum + o.points, 0));
  return { tier, points, occasions };
}

// Owned items with no outfit before and at least one with the candidate.
export function revivedItemIds(
  before: Record<string, number>,
  after: Record<string, number>,
): string[] {
  return Object.keys(before).filter(
    (id) => id !== CANDIDATE_ITEM_ID && before[id] === 0 && (after[id] ?? 0) > 0,
  );
}

// The slots an outfit around a candidate of this category needs filled, as
// alternatives: shoes go with a top and bottom, or with a one-piece.
export const SLOTS_NEEDED: Record<Exclude<Category, "accessory">, Category[][]> = {
  top: [["bottom", "shoes"]],
  bottom: [["top", "shoes"]],
  one_piece: [["shoes"]],
  shoes: [["top", "bottom"], ["one_piece"]],
  outerwear: [["top", "bottom", "shoes"], ["one_piece", "shoes"]],
};

export interface MissingSlot {
  category: Category;
  // False when the closet has nothing in this category at all.
  owned: boolean;
}

// For a candidate that forms no outfit: the slots where nothing goes with it,
// one list per alternative, in SLOTS_NEEDED order. Empty when some
// alternative has a match in every slot but those matches don't go with each
// other (or with the weather).
// `mightPair` should give unjudged pairs the benefit of the doubt.
export function missingSlots(
  candidate: ClosetItem,
  closet: readonly ClosetItem[],
  mightPair: Compatible,
): MissingSlot[][] {
  const category = categoryOf(candidate);
  if (category === "accessory") return [];
  const options = SLOTS_NEEDED[category].map((slots) =>
    slots
      .filter(
        (slot) =>
          !closet.some((item) => categoryOf(item) === slot && mightPair(candidate, item)),
      )
      .map((slot) => ({
        category: slot,
        owned: closet.some((item) => categoryOf(item) === slot),
      })),
  );
  if (options.some((missing) => missing.length === 0)) return [];
  // Drop an alternative that needs everything another one does and more.
  const has = (missing: MissingSlot[], slot: MissingSlot) =>
    missing.some((s) => s.category === slot.category);
  return options.filter(
    (missing) =>
      !options.some(
        (other) => other.length < missing.length && other.every((slot) => has(missing, slot)),
      ),
  );
}

// "nothing_owned": every missing slot is a category the closet has none of,
// so the closet is short, not the candidate. "no_match": something owned
// doesn't go with it.
export type GapKind = "nothing_owned" | "no_match";

export function gapKind(options: MissingSlot[][]): GapKind {
  return options.length > 0 && options.flat().every((s) => !s.owned) ? "nothing_owned" : "no_match";
}
