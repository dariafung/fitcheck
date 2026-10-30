import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ProfileStatement } from "@/lib/ai/schemas/build-profile";
import { Category, FeelingStructured, ItemTags, LifestyleMix } from "@/lib/ai/schemas/common";
import { profileHash, profileInput, visibleCard } from "@/lib/closet/style-profile";
import feelings from "./feelings.json";
import items from "./items.json";
import persona from "./persona.json";
import styleProfile from "./style-profile.json";

describe("seed data", () => {
  it("has a valid persona", () => {
    expect(() =>
      z.object({ id: z.uuid(), is_seed: z.literal(true), lifestyle_mix: LifestyleMix }).parse(persona),
    ).not.toThrow();
  });

  it("has valid items whose category matches their tags", () => {
    const Item = z.object({ id: z.uuid(), title: z.string(), category: Category, ai_tags: ItemTags });
    for (const item of items) {
      const parsed = Item.parse(item);
      expect(parsed.ai_tags.category).toBe(parsed.category);
    }
  });

  it("has valid feelings, one per seed item", () => {
    const Feeling = z.strictObject({
      id: z.uuid(),
      item_id: z.uuid(),
      raw_text: z.string().min(1),
      source: z.literal("typed"),
      structured: FeelingStructured.strict(),
      parsed_at: z.iso.datetime(),
    });
    for (const feeling of feelings) Feeling.parse(feeling);
    const itemIds = feelings.map((f) => f.item_id);
    expect(new Set(itemIds).size).toBe(itemIds.length);
    expect(itemIds.every((id) => items.some((i) => i.id === id))).toBe(true);
  });
});

describe("seed style card", () => {
  it("cites seed items only and matches the seed closet", () => {
    const Card = z.object({
      promptVersion: z.string(),
      inputHash: z.string(),
      headline: z.object({ text: z.string(), evidenceItemIds: z.array(z.uuid()).min(1) }),
      suits: z.array(ProfileStatement),
      avoid: z.array(ProfileStatement),
    });
    const card = Card.parse(styleProfile);
    const active = items.filter((i) => i.status === "active");
    const ids = new Set(active.map((i) => i.id));
    for (const s of [card.headline, ...card.suits, ...card.avoid]) {
      for (const id of s.evidenceItemIds) expect(ids).toContain(id);
    }
    expect(visibleCard({ ...card, generatedAt: "2026-10-29T00:00:00Z" }, ids)).not.toBeNull();
    // Fails when the seed closet changes: record the persona's card again
    // (or, while it is a placeholder, update the hash).
    const input = profileInput(active, feelings);
    expect(input).not.toBeNull();
    expect(card.inputHash).toBe(profileHash(input!));
  });
});
