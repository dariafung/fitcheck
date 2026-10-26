import type { z } from "zod";
import type { Category } from "../schemas/common";
import type {
  JudgePairingInput,
  JudgePairingOutput,
} from "../schemas/judge-pairing";

const COMPLEMENTS: Record<Category, Category[]> = {
  top: ["bottom", "shoes", "outerwear"],
  bottom: ["top", "shoes", "outerwear"],
  one_piece: ["shoes", "outerwear"],
  shoes: ["top", "bottom", "one_piece", "outerwear"],
  outerwear: ["top", "bottom", "one_piece", "shoes"],
  accessory: [],
};

// Pairs when categories complement each other and formality is close.
export function mockJudgePairing(
  input: z.output<typeof JudgePairingInput>,
): z.input<typeof JudgePairingOutput> {
  return {
    results: input.pairs.map(({ a, b }) => {
      const complementary = COMPLEMENTS[a.tags.category].includes(
        b.tags.category,
      );
      const close = Math.abs(a.tags.formality - b.tags.formality) <= 1;
      const pairs = complementary && close;
      return {
        aId: a.id,
        bId: b.id,
        pairs,
        reason: pairs
          ? "Mock: categories fit and formality matches."
          : "Mock: categories or formality don't match.",
      };
    }),
  };
}
