import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ProfileStatement } from "@/lib/ai/schemas/build-profile";
import { Category, FeelingStructured, ItemTags, LifestyleMix } from "@/lib/ai/schemas/common";
import { profileHash, profileInput, visibleCard } from "@/lib/closet/style-profile";
import { LetterSize, ShoeSize } from "@/lib/resale/size";
import feelings from "./feelings.json";
import items from "./items.json";
import persona from "./persona.json";
import styleProfile from "./style-profile.json";

describe("seed data", () => {
  it("has a valid persona", () => {
    expect(() =>
      z
        .object({
          id: z.uuid(),
          is_seed: z.literal(true),
          lifestyle_mix: LifestyleMix,
          top_size: LetterSize,
          bottom_size: LetterSize,
          shoe_size: ShoeSize,
        })
        .parse(persona),
    ).not.toThrow();
  });

  it("has the persona's sizes", () => {
    expect([persona.top_size, persona.bottom_size, persona.shoe_size]).toEqual(["S", "S", "W7.5"]);
  });

  it("has one photo per item in the persona's folder, and no others", () => {
    const paths = items.flatMap((i) => i.image_paths);
    expect(paths).toHaveLength(items.length);
    for (const p of paths) expect(path.dirname(p)).toBe(persona.id);
    const files = readdirSync(path.join(import.meta.dirname, "images"));
    expect(files.sort()).toEqual(paths.map((p) => path.basename(p)).sort());
  });

  it("has a size on every piece being passed on", () => {
    for (const item of items.filter((i) => i.status === "passing_on")) expect(item.size).toBeTruthy();
  });

  it("has valid items whose category matches their tags", () => {
    // user_tags hold only what was changed on the card.
    const Item = z.object({
      id: z.uuid(),
      title: z.string(),
      category: Category,
      ai_tags: ItemTags,
      user_tags: ItemTags.partial().optional(),
    });
    for (const item of items) {
      const parsed = Item.parse(item);
      expect(parsed.user_tags?.category ?? parsed.ai_tags.category).toBe(parsed.category);
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
