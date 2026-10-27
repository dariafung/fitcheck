import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Category, FeelingStructured, ItemTags, LifestyleMix } from "@/lib/ai/schemas/common";
import feelings from "./feelings.json";
import items from "./items.json";
import persona from "./persona.json";

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
