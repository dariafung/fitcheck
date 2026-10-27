// Gap metrics for one candidate, from the closet's outfits before and after
// adding it. Pure code; values are exported so they can be tuned in testing.
import { Occasion, type Category, type LifestyleMix } from "../ai/schemas/common";
import { CANDIDATE_ITEM_ID } from "./pairings";
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
}

// An occasion the user wants no outfits for never counts.
export function occasionTier(before: number, after: number, wanted: number): OccasionGapTier {
  if (wanted === 0 || after <= before) return "none";
  if (before >= wanted) return "already_enough";
  return before === 0 ? "from_zero" : "more_outfits";
}

const rank = (tier: OccasionGapTier) => OCCASION_GAP_TIERS.indexOf(tier);

// Every occasion the candidate adds outfits to, best tier first (ties keep
// the Occasion order), and the best tier overall. Without a lifestyle mix
// nothing counts.
export function occasionGap(
  mix: LifestyleMix | null,
  before: Record<Occasion, number>,
  after: Record<Occasion, number>,
): { tier: OccasionGapTier; occasions: OccasionChange[] } {
  if (!mix) return { tier: "none", occasions: [] };
  const occasions = Occasion.options
    .map((occasion) => {
      const change = { occasion, before: before[occasion], after: after[occasion], wanted: mix[occasion] };
      return { ...change, tier: occasionTier(change.before, change.after, change.wanted) };
    })
    .filter((o) => o.tier !== "none")
    .sort((a, b) => rank(b.tier) - rank(a.tier));
  return { tier: occasions[0]?.tier ?? "none", occasions };
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

export type DuplicateTier = "none" | "similar" | "near_identical";

// "T-Shirt", "t shirt" and "tshirt" compare equal.
function normalize(text: string | undefined): string | undefined {
  const plain = text?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return plain || undefined;
}

// Same category and color family is similar; with the same fit and no
// conflicting subcategory too, it's near identical. No color family, no match.
export function duplicateTier(candidate: ClosetItem, owned: ClosetItem): DuplicateTier {
  if (categoryOf(candidate) !== categoryOf(owned)) return "none";
  if (!candidate.colorFamily || candidate.colorFamily !== owned.colorFamily) return "none";
  const fitA = candidate.tags.fit;
  const subA = normalize(candidate.tags.subcategory);
  const subB = normalize(owned.tags.subcategory);
  const sameFit = fitA !== undefined && fitA === owned.tags.fit;
  const subConflict = subA !== undefined && subB !== undefined && subA !== subB;
  return sameFit && !subConflict ? "near_identical" : "similar";
}

// The closest owned item; on a tie, the first in the list.
export function findDuplicate(
  candidate: ClosetItem,
  closet: readonly ClosetItem[],
): { tier: DuplicateTier; item: ClosetItem | null } {
  let best: { tier: DuplicateTier; item: ClosetItem | null } = { tier: "none", item: null };
  for (const item of closet) {
    const tier = duplicateTier(candidate, item);
    if (tier === "near_identical") return { tier, item };
    if (tier === "similar" && best.tier === "none") best = { tier, item };
  }
  return best;
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
// from the alternative closest to complete. Empty when every slot has a
// match but those matches don't go with each other (or with the weather).
// `mightPair` should give unjudged pairs the benefit of the doubt.
export function missingSlots(
  candidate: ClosetItem,
  closet: readonly ClosetItem[],
  mightPair: Compatible,
): MissingSlot[] {
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
  return options.reduce((best, missing) => (missing.length < best.length ? missing : best));
}
