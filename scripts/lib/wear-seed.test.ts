import { describe, expect, it } from "vitest";
import feelings from "../../seed/feelings.json";
import items from "../../seed/items.json";
import persona from "../../seed/persona.json";
import { addDays, SEED_DAYS, seedOutfitLog, type SeedFeeling, type SeedItem } from "./wear-seed.mjs";

const LAST_DAY = "2026-10-28";
const OCCASIONS = ["work", "school", "social", "sport", "home"];
const MIX = { work: 0, school: 3, social: 2, sport: 3, home: 3 };

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const piece = (n: number, category: string, extra: Partial<SeedItem["ai_tags"]> = {}): SeedItem => ({
  id: id(n),
  title: `Piece ${n}`,
  category,
  status: "active",
  ai_tags: { formality: 2, occasions: [], tempRangeF: { min: 30, max: 90 }, ...extra },
});
const felt = (n: number, liked: string, flattering = liked): SeedFeeling => ({
  item_id: id(n),
  structured: { liked, flattering, aspects: [] },
});

// A fuller closet like the one the persona will get.
const CLOSET: SeedItem[] = [
  piece(1, "top"),
  piece(2, "top"),
  piece(3, "top", { occasions: ["sport"] }),
  piece(4, "top", { formality: 3 }),
  piece(5, "bottom"),
  piece(6, "bottom"),
  piece(7, "bottom", { occasions: ["sport"] }),
  piece(8, "one_piece", { formality: 4 }),
  piece(9, "shoes"),
  piece(10, "shoes", { occasions: ["sport"] }),
  piece(11, "shoes"),
  piece(12, "outerwear"),
  piece(13, "outerwear"),
  piece(14, "top"),
  piece(15, "bottom"),
];
const FEELINGS = [felt(8, "yes"), felt(4, "yes"), felt(6, "no"), felt(1, "yes"), felt(9, "mixed", "unknown")];

const run = (extra: Partial<Parameters<typeof seedOutfitLog>[0]> = {}) =>
  seedOutfitLog({ personaId: persona.id, items: CLOSET, feelings: FEELINGS, lifestyleMix: MIX, lastDay: LAST_DAY, ...extra });

function counts(rows: { item_ids: string[] }[]) {
  const c = new Map<string, number>();
  for (const r of rows) for (const i of r.item_ids) c.set(i, (c.get(i) ?? 0) + 1);
  return c;
}

function expectValidRows(rows: ReturnType<typeof run>["rows"], closet: SeedItem[]) {
  const ids = new Set(closet.map((i) => i.id));
  const seen = new Set<string>();
  for (const row of rows) {
    expect(row.user_id).toBe(persona.id);
    expect(row.worn_on >= addDays(LAST_DAY, -(SEED_DAYS - 1)) && row.worn_on <= LAST_DAY).toBe(true);
    expect(row.item_ids.length).toBeGreaterThan(0);
    expect(row.item_ids).toEqual([...row.item_ids].sort());
    expect(row.item_ids.every((i) => ids.has(i))).toBe(true);
    expect(row.occasion === null || OCCASIONS.includes(row.occasion)).toBe(true);
    // outfit_logs_unique_outfit
    const key = `${row.worn_on}|${row.item_ids.join()}`;
    expect(seen.has(key)).toBe(false);
    seen.add(key);
  }
  expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
}

describe("seedOutfitLog", () => {
  it("gives the same log for the same closet", () => {
    expect(run()).toEqual(run());
  });

  it("logs most of the 30 days, as real outfits", () => {
    const { rows } = run();
    expectValidRows(rows, CLOSET);
    expect(new Set(rows.map((r) => r.worn_on)).size).toBeGreaterThanOrEqual(22);
    const category = new Map(CLOSET.map((i) => [i.id, i.category]));
    for (const row of rows.filter((r) => r.occasion !== "sport")) {
      const kinds = row.item_ids.map((i) => category.get(i));
      expect(kinds).toContain("shoes");
      expect(kinds.includes("one_piece") !== (kinds.includes("top") && kinds.includes("bottom"))).toBe(true);
    }
  });

  it("tells the story: a praised piece worn once, a knocked one worn most, one never worn", () => {
    const { rows, roles } = run();
    // The most formal praised piece; the knocked bottom.
    expect(roles.get(id(8))).toBe("rare");
    expect(roles.get(id(6))).toBe("often");
    const never = [...roles].find(([, r]) => r === "never")?.[0];
    expect(never).toBeDefined();
    const c = counts(rows);
    expect(c.get(id(8))).toBe(1);
    expect(c.get(never!) ?? 0).toBe(0);
    const bottoms = CLOSET.filter((i) => i.category === "bottom" && i.id !== id(6)).map((i) => c.get(i.id) ?? 0);
    expect(c.get(id(6))).toBeGreaterThan(Math.max(...bottoms));
  });

  it("wears the same outfit to every sport day", () => {
    const sport = run().rows.filter((r) => r.occasion === "sport");
    expect(sport.length).toBeGreaterThan(0);
    expect(new Set(sport.map((r) => r.item_ids.join())).size).toBe(1);
  });

  it("follows a hand-made plan", () => {
    const { rows, roles } = run({ plan: { [id(2)]: "rare", [id(5)]: "never", "not-in-closet": "often" } });
    expect([...roles]).toEqual([
      [id(2), "rare"],
      [id(5), "never"],
    ]);
    const c = counts(rows);
    expect(c.get(id(2))).toBe(1);
    expect(c.get(id(5)) ?? 0).toBe(0);
  });

  it("works on the seed closet as it is today", () => {
    const { rows, roles } = seedOutfitLog({
      personaId: persona.id,
      items: items as SeedItem[],
      feelings: feelings as SeedFeeling[],
      lifestyleMix: persona.lifestyle_mix,
      lastDay: LAST_DAY,
    });
    expectValidRows(rows, items as SeedItem[]);
    expect(rows.length).toBeGreaterThan(0);
    // The shirt they love is worn once; the jeans they never wear are the knocked piece.
    expect(roles.get("852c8e3d-abf7-4955-ab65-9d83194a02ae")).toBe("rare");
    expect(roles.get("c81b2b56-1f62-4284-83b6-7307a6355ac5")).toBe("often");
  });
});
