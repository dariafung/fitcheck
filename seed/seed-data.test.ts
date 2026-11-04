import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ProfileStatement } from "@/lib/ai/schemas/build-profile";
import { Category, FeelingStructured, ItemTags, LifestyleMix } from "@/lib/ai/schemas/common";
import { profileHash, profileInput, visibleCard } from "@/lib/closet/style-profile";
import { RESALE_SCORE_THRESHOLD } from "@/lib/resale/matches";
import { Condition } from "@/lib/resale/listing";
import { filterBySize } from "@/lib/resale/pool";
import { LetterSize, ShoeSize } from "@/lib/resale/size";
import feelings from "./feelings.json";
import items from "./items.json";
import neighbors from "./neighbors.json";
import persona from "./persona.json";
import resaleMatches from "./resale-matches.json";
import styleProfile from "./style-profile.json";
import { Nickname } from "../lib/profile/nickname";

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

  it("has one photo per item in the persona's folder, the neighbors' pieces' photos, and no others", () => {
    const paths = items.flatMap((i) => i.image_paths);
    expect(paths).toHaveLength(items.length);
    for (const p of paths) expect(path.dirname(p)).toBe(persona.id);
    const files = readdirSync(path.join(import.meta.dirname, "images"));
    // The seed neighbors' pieces have a photo here too.
    const neighborFiles = neighbors.items.flatMap((i) => i.image_paths).map((p) => path.basename(p));
    expect(files.sort()).toEqual([...paths.map((p) => path.basename(p)), ...neighborFiles].sort());
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

describe("seed persona's name", () => {
  it("is the nickname the demo shows to buyers", () => {
    expect(persona.display_name).toBe("figment");
  });
});

describe("seed neighbors", () => {
  // Only what matching needs: a name, sizes and the opt-in.
  const Neighbor = z.strictObject({
    id: z.uuid(),
    // A nickname, as people pick at sign-up.
    display_name: Nickname,
    is_seed: z.literal(true),
    resale_opt_in: z.literal(true),
    top_size: LetterSize,
    bottom_size: LetterSize,
    shoe_size: ShoeSize,
  });

  it("are opted-in seed users with a name and sizes only, apart from the persona", () => {
    for (const neighbor of neighbors.users) Neighbor.parse(neighbor);
    expect(neighbors.users.map((n) => n.id)).not.toContain(persona.id);
  });

  it("own only the pieces they pass on, each listed with a size, price and condition", () => {
    const Item = z.object({
      id: z.uuid(),
      user_id: z.uuid(),
      status: z.literal("passing_on"),
      size: z.string().min(1),
      asking_price_cents: z.number().int().min(0),
      condition: Condition,
      category: Category,
      ai_tags: ItemTags,
      image_paths: z.array(z.string()),
    });
    const ids = new Set(neighbors.users.map((n) => n.id));
    for (const item of neighbors.items) {
      const parsed = Item.parse(item);
      expect(parsed.ai_tags.category).toBe(parsed.category);
      expect(parsed.category).not.toBe("accessory");
      expect(ids.has(parsed.user_id)).toBe(true);
    }
    expect(neighbors.items).toHaveLength(2);
  });
});

describe("seeded resale matches", () => {
  const Match = z.strictObject({
    item_id: z.uuid(),
    seller_id: z.uuid(),
    buyer_id: z.uuid(),
    score: z.number().min(0).max(100),
    highlights: z.array(z.enum(["suitsYou", "outfits", "revives", "fillsGap", "notRepeat"])),
    buyer_reasons: z.array(z.string().min(1)).min(1),
  });
  const matches = resaleMatches.matches.map((m) => Match.parse(m));
  const owner = new Map([...items.map((i) => [i.id, persona.id] as const), ...neighbors.items.map((i) => [i.id, i.user_id] as const)]);
  const strong = (itemId: string) => matches.filter((m) => m.item_id === itemId && m.score >= RESALE_SCORE_THRESHOLD);

  it("name each piece's real seller, never the buyer", () => {
    for (const m of matches) {
      expect(owner.get(m.item_id)).toBe(m.seller_id);
      expect(m.buyer_id).not.toBe(m.seller_id);
    }
  });

  it("cover every neighbor whose size fits each of the persona's passing-on pieces, so none is left to check", () => {
    const pool = neighbors.users.map((n) => ({
      id: n.id,
      sizes: { top: LetterSize.parse(n.top_size), bottom: LetterSize.parse(n.bottom_size), shoe: ShoeSize.parse(n.shoe_size) },
    }));
    for (const item of items.filter((i) => i.status === "passing_on")) {
      const fit = filterBySize(pool, item.size, Category.parse(item.category));
      const fitting = fit.state === "ok" ? fit.buyerIds : [];
      expect(fitting.length).toBeGreaterThan(0);
      const checked = matches.filter((m) => m.item_id === item.id).map((m) => m.buyer_id);
      expect(new Set(checked)).toEqual(new Set(fitting));
    }
  });

  it("give the persona 3 buyers for the baby tee and 2 for the shorts", () => {
    const byTitle = (title: string) => items.find((i) => i.title === title)!.id;
    expect(strong(byTitle("100% Cotton Crew Baby Tee"))).toHaveLength(3);
    expect(strong(byTitle("Fleece Shortie Shorts"))).toHaveLength(2);
  });

  it("put every neighbor's piece in the persona's Suits you, with a few reasons", () => {
    for (const item of neighbors.items) {
      const mine = matches.filter((m) => m.item_id === item.id);
      expect(mine).toHaveLength(1);
      expect(mine[0].buyer_id).toBe(persona.id);
      expect(mine[0].score).toBeGreaterThanOrEqual(RESALE_SCORE_THRESHOLD);
      expect(mine[0].buyer_reasons.length).toBeGreaterThanOrEqual(2);
    }
  });
});
