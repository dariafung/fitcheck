import { describe, expect, it } from "vitest";
import { fingerprint, type BuyerState, type SellerItem } from "./fingerprint";

const ITEM: SellerItem = {
  title: "Gray baby tee",
  tags: { category: "top", colors: [], materials: [], formality: 2, occasions: ["school"] },
  photoPath: "seller/tee.webp",
};

const BUYER: BuyerState = {
  id: "buyer",
  createdAt: "2026-10-01T00:00:00Z",
  lifestyleMix: { work: 0, school: 3, social: 0, sport: 0, home: 0 },
  profile: { bodyShape: "pear", heightCm: 160 },
  items: [
    { id: "a", updatedAt: "2026-10-02T00:00:00Z" },
    { id: "b", updatedAt: "2026-10-02T00:00:00Z" },
  ],
  feelings: [{ id: "f", parsedAt: "2026-10-03T00:00:00Z" }],
  card: { inputHash: "hash", promptVersion: "build-profile@3" },
};

describe("fingerprint", () => {
  const base = fingerprint(ITEM, BUYER, "live");

  it("doesn't depend on row order or when the buyer joined", () => {
    expect(fingerprint(ITEM, { ...BUYER, items: [...BUYER.items].reverse(), createdAt: "2026-01-01" }, "live")).toBe(base);
  });

  it("changes with anything the buy check reads", () => {
    const changes: BuyerState[] = [
      { ...BUYER, items: [...BUYER.items, { id: "c", updatedAt: "2026-10-04T00:00:00Z" }] },
      { ...BUYER, items: [{ id: "a", updatedAt: "2026-10-05T00:00:00Z" }, BUYER.items[1]] },
      { ...BUYER, feelings: [{ id: "f", parsedAt: "2026-10-06T00:00:00Z" }] },
      { ...BUYER, profile: { bodyShape: "apple", heightCm: 160 } },
      { ...BUYER, lifestyleMix: { ...(BUYER.lifestyleMix as object), school: 4 } },
      { ...BUYER, card: { inputHash: "new", promptVersion: "build-profile@3" } },
      { ...BUYER, card: null },
    ];
    for (const buyer of changes) expect(fingerprint(ITEM, buyer, "live")).not.toBe(base);
    expect(fingerprint({ ...ITEM, photoPath: null }, BUYER, "live")).not.toBe(base);
    expect(fingerprint({ ...ITEM, tags: { ...ITEM.tags, formality: 3 } }, BUYER, "live")).not.toBe(base);
    expect(fingerprint(ITEM, BUYER, "mock")).not.toBe(base);
  });
});
