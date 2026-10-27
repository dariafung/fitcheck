// The 0–100 match score: five parts, all computed in code. Values are
// exported so they can be tuned during testing.
import type { DuplicateTier } from "./gaps";

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

// Each outfit the candidate forms; 8 outfits fill the part.
export const POINTS_PER_OUTFIT = 2.5;

// Each owned item it revives, up to the part's max.
export const POINTS_PER_REVIVED = 4;

// Fills a gap: each outfit added to an occasion that's short earns this,
// times how short it was (short / wanted, before the candidate). Outfits past
// the shortfall earn nothing; occasions add up to the part's max.
export const GAP_POINTS_PER_OUTFIT = 5;

export const DUPLICATE_POINTS: Record<DuplicateTier, number> = {
  near_identical: 0,
  similar: 5,
  none: 10,
};

export function countPoints(count: number, perEach: number, max: number): number {
  return Math.min(count * perEach, max);
}

// One occasion's share, before the cap. An occasion the user wants no
// outfits for, or already has enough for, earns nothing.
export function occasionPoints(before: number, after: number, wanted: number): number {
  const short = Math.max(0, wanted - before);
  if (short === 0) return 0;
  const filled = Math.min(Math.max(0, after - before), short);
  return GAP_POINTS_PER_OUTFIT * (short / wanted) * filled;
}

// Parts and the total keep one decimal.
export function roundPart(points: number): number {
  return Math.round(points * 10) / 10;
}
