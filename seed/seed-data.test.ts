import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Category, ItemTags, LifestyleMix } from "@/lib/ai/schemas/common";
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
});
