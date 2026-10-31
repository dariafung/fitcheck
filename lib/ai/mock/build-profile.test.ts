import { describe, expect, it } from "vitest";
import { BuildProfileInput, profileFacts } from "../schemas/build-profile";
import type { ItemSummary } from "../schemas/common";
import { mockBuildProfile } from "./build-profile";

const item = (n: number, tags: Partial<ItemSummary["tags"]> & Pick<ItemSummary["tags"], "category">): ItemSummary => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  title: `Item ${n}`,
  tags: { colors: [{ name: "white" }], materials: ["cotton"], formality: 2, occasions: ["school"], ...tags },
});
const ITEMS = [item(1, { category: "top", fit: "relaxed" }), item(2, { category: "bottom", colors: [{ name: "navy" }] }), item(3, { category: "shoes" })];
const INPUT = BuildProfileInput.parse({
  items: ITEMS,
  feelings: [
    {
      itemId: ITEMS[0].id,
      flattering: "yes",
      liked: "yes",
      aspects: [{ aspect: "color", sentiment: "positive", said: "looks bright", means: "white brightens your face" }],
      occasions: [],
      mood: [],
      summary: "",
    },
    {
      itemId: ITEMS[1].id,
      flattering: "no",
      liked: "no",
      aspects: [{ aspect: "fit", sentiment: "negative", area: "waist", said: "digs in", means: "waistbands need give" }],
      occasions: [],
      mood: [],
      summary: "",
    },
    { itemId: ITEMS[2].id, flattering: "unknown", liked: "yes", occasions: [], mood: [], summary: "" },
  ],
});

describe("mockBuildProfile", () => {
  it("gives the same card for the same closet", () => {
    expect(mockBuildProfile(INPUT)).toEqual(mockBuildProfile(INPUT));
  });

  it("covers every topic with something to go on, citing items from the input", () => {
    const out = mockBuildProfile(INPUT);
    const covered = new Set([...out.suits, ...out.avoid].map((s) => s.topic));
    for (const topic of profileFacts(INPUT).topics) expect(covered).toContain(topic);
    const ids = new Set(ITEMS.map((i) => i.id));
    for (const s of [out.headline, ...out.suits, ...out.avoid]) {
      expect(s.evidenceItemIds.length).toBeGreaterThan(0);
      for (const id of s.evidenceItemIds) expect(ids).toContain(id);
    }
  });

  it("turns negative feelings into things to skip, never what was said", () => {
    const out = mockBuildProfile(INPUT);
    expect(out.avoid).toEqual([{ topic: "fit", text: "Waistbands need give.", evidenceItemIds: [ITEMS[1].id] }]);
    expect(out.suits).toContainEqual({ topic: "color", text: "White brightens your face.", evidenceItemIds: [ITEMS[0].id] });
    expect(JSON.stringify(out)).not.toMatch(/looks bright|digs in/);
  });
});
