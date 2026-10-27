import { describe, expect, it } from "vitest";
import { MOCK_INCOMPLETE_TITLE, mockScorePurchase } from "./score-purchase";

const tags = (category: "top" | "bottom") => ({ category, colors: [], materials: [], formality: 3, occasions: [] });
const felt = (category: "top" | "bottom", liked: "yes" | "no" | "unknown") => ({
  id: "00000000-0000-4000-8000-000000000001",
  title: `Felt ${category}`,
  tags: tags(category),
  feeling: { flattering: "unknown" as const, liked, aspects: [], mood: [], summary: "" },
});
const input = (...feltItems: ReturnType<typeof felt>[]): Parameters<typeof mockScorePurchase>[0] => ({
  candidate: { id: "00000000-0000-4000-8000-000000000000", title: "Candidate", tags: tags("top") },
  profile: { lifestyleMix: { work: 0, school: 0, social: 0, sport: 0, home: 0 } },
  feltItems,
  troubleAreas: [],
  questions: [
    { id: "a", text: "A?" },
    { id: "b", text: "B?" },
  ],
});
const scores = (...feltItems: ReturnType<typeof felt>[]) => mockScorePurchase(input(...feltItems)).answers.map((a) => a.score);

describe("mockScorePurchase", () => {
  it("scores by a felt item of the same category", () => {
    expect(scores(felt("top", "yes"))).toEqual([6, 6]);
    expect(scores(felt("top", "no"))).toEqual([2, 2]);
    expect(scores(felt("top", "unknown"), felt("bottom", "yes"))).toEqual([4, 4]);
    expect(scores()).toEqual([4, 4]);
  });

  it("leaves a question out for the never-finishes title", () => {
    const base = input();
    const out = mockScorePurchase({ ...base, candidate: { ...base.candidate, title: MOCK_INCOMPLETE_TITLE } });
    expect(out.answers.map((a) => a.id)).toEqual(["b"]);
  });
});
