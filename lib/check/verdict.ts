// The one-line verdict under the score: four bands, all caps, at most four
// words. 60 is the same line resale uses for "would want it"
// (lib/resale/matches.ts).
import type { GapKind } from "./gaps";

export const VERDICTS = {
  worthBuying: "WORTH BUYING",
  goodAdd: "A GOOD ADD",
  thinkTwice: "THINK TWICE",
  skip: "SKIP THIS ONE",
} as const;

export type Verdict = (typeof VERDICTS)[keyof typeof VERDICTS];

// Lowest score of each band, best first.
export const VERDICT_BANDS: [number, Verdict][] = [
  [75, VERDICTS.worthBuying],
  [60, VERDICTS.goodAdd],
  [40, VERDICTS.thinkTwice],
  [0, VERDICTS.skip],
];

export function verdictFor(score: number): Verdict {
  return VERDICT_BANDS.find(([min]) => score >= min)?.[1] ?? VERDICTS.skip;
}

// A piece that creates a gap (nothing owned goes with it) reads THINK TWICE
// at best, whatever it scores. A separate step, so it can go on its own.
export function capForGap(verdict: Verdict, gap: { kind: GapKind } | null): Verdict {
  if (gap?.kind !== "no_match") return verdict;
  return verdict === VERDICTS.worthBuying || verdict === VERDICTS.goodAdd ? VERDICTS.thinkTwice : verdict;
}

export function verdict(score: number, gap: { kind: GapKind } | null): Verdict {
  return capForGap(verdictFor(score), gap);
}
