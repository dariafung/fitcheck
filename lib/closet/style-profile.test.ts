import { describe, expect, it } from "vitest";
import { MIN_ROWS, profileHash, profileInput, visibleCard, type StoredCard } from "./style-profile";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (n: number, userTags: unknown = {}) => ({
  id: id(n),
  title: `Item ${n}`,
  category: "top",
  ai_tags: { category: "top", colors: [{ name: "white" }], materials: ["cotton"], formality: 2, occasions: ["school"] },
  user_tags: userTags,
});
const structured = (summary = "Fine.") => ({
  flattering: "yes",
  liked: "yes",
  aspects: [{ aspect: "color", sentiment: "positive", said: "bright", means: "light colors suit you" }],
  occasions: [],
  mood: [],
  summary,
});
const ITEMS = [row(3), row(1), row(2), row(4)];
const FEELINGS = [1, 2, 3].map((n) => ({ item_id: id(n), structured: structured() }));

describe("profileInput", () => {
  it("sorts items by id and keeps each item's latest parsed feeling", () => {
    const input = profileInput(ITEMS, [{ item_id: id(1), structured: structured("Newest.") }, ...FEELINGS]);
    expect(input?.items.map((i) => i.id)).toEqual([id(1), id(2), id(3), id(4)]);
    expect(input?.feelings.map((f) => [f.itemId, f.summary])).toEqual([
      [id(1), "Newest."],
      [id(2), "Fine."],
      [id(3), "Fine."],
    ]);
  });

  it("puts the user's tag edits on top", () => {
    const input = profileInput([row(1, { fit: "oversized" }), row(2), row(3)], FEELINGS);
    expect(input?.items[0].tags.fit).toBe("oversized");
  });

  it("skips feelings with no or broken structured fields, and items not given", () => {
    const feelings = [
      ...FEELINGS.slice(0, 2),
      { item_id: id(3), structured: null },
      { item_id: id(4), structured: { flattering: "maybe" } },
      { item_id: id(9), structured: structured() },
    ];
    expect(profileInput(ITEMS, feelings)).toBeNull();
  });

  it("needs three parsed feelings", () => {
    expect(profileInput(ITEMS, FEELINGS.slice(0, 2))).toBeNull();
    expect(profileInput(ITEMS, FEELINGS)).not.toBeNull();
  });
});

describe("profileHash", () => {
  const hash = (items = ITEMS, feelings = FEELINGS) => profileHash(profileInput(items, feelings)!);

  it("is the same for the same closet in any order", () => {
    expect(hash([...ITEMS].reverse(), [...FEELINGS].reverse())).toBe(hash());
  });

  it("changes with an item, a tag edit or a parsed feeling", () => {
    expect(hash(ITEMS.slice(0, 3))).not.toBe(hash());
    expect(hash([row(3), row(1, { fit: "slim" }), row(2), row(4)])).not.toBe(hash());
    expect(hash(ITEMS, [{ item_id: id(1), structured: structured("Changed.") }, ...FEELINGS.slice(1)])).not.toBe(hash());
  });
});

describe("visibleCard", () => {
  const card: StoredCard = {
    headline: { text: "Easy basics.", evidenceItemIds: [id(1), id(2)] },
    suits: [
      { topic: "color", text: "Light colors.", evidenceItemIds: [id(1)] },
      { topic: "feel", text: "Cotton.", evidenceItemIds: [id(2)] },
      { topic: "style", text: "Simple pieces.", evidenceItemIds: [id(3)] },
      { topic: "occasion", text: "Mostly school.", evidenceItemIds: [id(1), id(3)] },
    ],
    avoid: [{ topic: "color", text: "Muddy browns.", evidenceItemIds: [id(4)] }],
    inputHash: "h",
    promptVersion: "build-profile@3",
    generatedAt: "2026-10-29T12:00:00Z",
  };
  const all = new Set([1, 2, 3, 4].map(id));

  it("groups statements into rows by topic, in a fixed order", () => {
    expect(visibleCard(card, all)).toEqual({
      headline: "Easy basics.",
      rows: [
        { topic: "color", suits: "Light colors.", avoid: "Muddy browns." },
        { topic: "feel", suits: "Cotton." },
        { topic: "style", suits: "Simple pieces." },
        { topic: "occasion", suits: "Mostly school." },
      ],
      generatedAt: "2026-10-29T12:00:00Z",
    });
  });

  it("drops statements whose items have all left the closet", () => {
    const rows = visibleCard(card, new Set([1, 2, 3].map(id)))?.rows;
    expect(rows?.[0]).toEqual({ topic: "color", suits: "Light colors." });
  });

  it(`is null without the headline or with fewer than ${MIN_ROWS} rows`, () => {
    expect(visibleCard(card, new Set([3, 4].map(id)))).toBeNull();
    expect(visibleCard(card, new Set([2].map(id)))).toBeNull();
  });
});
