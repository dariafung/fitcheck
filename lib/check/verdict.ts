// The one-line verdict under the score: four bands, all caps, at most four
// words. 60 is the same line resale uses for "would want it"
// (lib/resale/matches.ts).

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
