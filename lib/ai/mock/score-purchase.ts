import type { z } from "zod";
import type {
  ScorePurchaseInput,
  ScorePurchaseOutput,
} from "../schemas/score-purchase";

// A candidate with this title never gets every question answered, so tests
// can reach the "didn't finish" path.
export const MOCK_INCOMPLETE_TITLE = "Mock never finishes";

// By rule, not at random: e2e tests change the demo closet while others run,
// so a seeded mock would shift under them. A felt item of the same category
// sets every score: liked 6, disliked 2, neither (or none) 4.
export function mockScorePurchase(
  input: z.output<typeof ScorePurchaseInput>,
): z.input<typeof ScorePurchaseOutput> {
  const category = input.candidate.tags.category;
  const near = input.feltItems.find((item) => item.tags.category === category && item.feeling.liked !== "unknown");
  const score = near?.feeling.liked === "yes" ? 6 : near?.feeling.liked === "no" ? 2 : 4;
  const reason = near ? `Mock: compared with your ${near.title}.` : "Mock: nothing to go on.";
  const questions = input.candidate.title === MOCK_INCOMPLETE_TITLE ? input.questions.slice(1) : input.questions;
  return {
    answers: questions.map((q) => ({ id: q.id, score, reason })),
    summary: `Mock check for ${input.candidate.title}.`,
  };
}
