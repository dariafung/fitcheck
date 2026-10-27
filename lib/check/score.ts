// The 0–100 match score: five parts, all computed in code. Tier boundaries
// are exported so they can be tuned during testing.
import type { DuplicateTier, OccasionGapTier } from "./gaps";

export const MAX_POINTS = {
  suitsYou: 40,
  outfits: 20,
  revives: 15,
  fillsGap: 15,
  notRepeat: 10,
} as const;

// Suits you: each "yes" earns this; a question with nothing to compare
// against earns half.
export const POINTS_PER_YES = 8;
export const NO_DATA_POINTS = POINTS_PER_YES / 2;

// [at least this many, points], highest first.
export type Tiers = readonly (readonly [number, number])[];

// Outfits the candidate forms: 0 / 1–2 / 3–5 / 6+.
export const OUTFIT_TIERS: Tiers = [
  [6, 20],
  [3, 15],
  [1, 8],
  [0, 0],
];

// Owned items it revives: 0 / 1 / 2–3 / 4+.
export const REVIVE_TIERS: Tiers = [
  [4, 15],
  [2, 10],
  [1, 5],
  [0, 0],
];

export const OCCASION_GAP_POINTS: Record<OccasionGapTier, number> = {
  none: 0,
  already_enough: 3,
  more_outfits: 8,
  from_zero: 15,
};

export const DUPLICATE_POINTS: Record<DuplicateTier, number> = {
  near_identical: 0,
  similar: 5,
  none: 10,
};

export function tierPoints(count: number, tiers: Tiers): number {
  return tiers.find(([min]) => count >= min)?.[1] ?? 0;
}
