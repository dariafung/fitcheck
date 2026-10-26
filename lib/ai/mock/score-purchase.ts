import type { z } from "zod";
import type {
  ScorePurchaseInput,
  ScorePurchaseOutput,
} from "../schemas/score-purchase";
import { seededRandom } from "./random";

export function mockScorePurchase(
  input: z.output<typeof ScorePurchaseInput>,
  seed: string,
): z.input<typeof ScorePurchaseOutput> {
  const random = seededRandom(seed);
  return {
    answers: input.questions.map((q) => {
      const answer = random() < 0.6;
      return {
        id: q.id,
        answer,
        reason: answer ? "Mock: close to pieces you like." : "Mock: not like your favorites.",
      };
    }),
    summary: `Mock check for ${input.candidate.title}.`,
  };
}
