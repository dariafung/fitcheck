import type { z } from "zod";
import type { ItemSummary } from "../schemas/common";
import type { JudgeRepeatInput, JudgeRepeatOutput } from "../schemas/judge-repeat";

// "T-Shirt", "t shirt" and "tshirt" compare equal.
function normalize(text: string | undefined): string | undefined {
  const plain = text?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return plain || undefined;
}

// Same category and color family scores 4; with the same fit and no
// conflicting subcategory too, 1. No color family, no match.
function repeatScore(candidate: ItemSummary, owned: ItemSummary): number {
  const a = candidate.tags;
  const b = owned.tags;
  if (a.category !== b.category || !a.colorFamily || a.colorFamily !== b.colorFamily) return 10;
  const sameFit = a.fit !== undefined && a.fit === b.fit;
  const subA = normalize(a.subcategory);
  const subB = normalize(b.subcategory);
  const subConflict = subA !== undefined && subB !== undefined && subA !== subB;
  return sameFit && !subConflict ? 1 : 4;
}

// By rule, not at random: e2e tests change the demo closet while others run.
// The lowest score wins; on a tie, the first in the closet.
export function mockJudgeRepeat(input: z.output<typeof JudgeRepeatInput>): z.input<typeof JudgeRepeatOutput> {
  let best: { score: number; item: ItemSummary | null } = { score: 10, item: null };
  for (const item of input.closet) {
    const score = repeatScore(input.candidate, item);
    if (score < best.score) best = { score, item };
  }
  return {
    score: best.score,
    closestId: best.item?.id ?? null,
    reason: best.item ? `Mock: a lot like your ${best.item.title}.` : "Mock: nothing like it in your closet.",
  };
}
