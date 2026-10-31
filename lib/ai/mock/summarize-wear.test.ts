import { describe, expect, it } from "vitest";
import type { ItemSummary } from "../schemas/common";
import { SummarizeWearInput, SummarizeWearOutput } from "../schemas/summarize-wear";
import { mockSummarizeWear } from "./summarize-wear";

const item = (n: number, wornCount: number, extra: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  title: `Item ${n}`,
  tags: { category: "top", colors: [], materials: [], formality: 2, occasions: [] } satisfies ItemSummary["tags"],
  wornCount,
  lastWornDaysAgo: wornCount > 0 ? 1 : null,
  addedDaysAgo: null,
  feeling: null,
  ...extra,
});
const yes = { flattering: "yes", liked: "yes", aspects: [] };
const no = { flattering: "no", liked: "no", aspects: [] };

const input = (items: ReturnType<typeof item>[]) =>
  SummarizeWearInput.parse({ windowDays: 30, loggedDays: 20, outfitCount: 24, items, occasions: [] });

describe("mockSummarizeWear", () => {
  it("tells the say-vs-wear story first, then idle and favorite pieces", () => {
    const out = SummarizeWearOutput.parse(
      mockSummarizeWear(input([item(1, 1, { feeling: yes }), item(2, 12, { feeling: no }), item(3, 0), item(4, 6)])),
    );
    expect(out.insights.map((i) => i.text)).toEqual([
      "Mock: you love the Item 1 but wore it once.",
      "Mock: you knock the Item 2 but wore it 12 times.",
      "Mock: the Item 3 sat out all 30 days.",
    ]);
  });

  it("never calls a newly added piece idle, and always says something", () => {
    const out = mockSummarizeWear(input([item(1, 0, { addedDaysAgo: 3 }), item(2, 4)]));
    expect(out.insights).toEqual([{ kind: "favorite", text: "Mock: the Item 2 is your go-to: 4 times.", itemIds: [item(2, 4).id] }]);
    expect(mockSummarizeWear(input([item(1, 0, { addedDaysAgo: 3 })])).insights).toHaveLength(1);
  });
});
