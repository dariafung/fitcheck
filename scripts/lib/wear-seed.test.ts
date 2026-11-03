import { describe, expect, it } from "vitest";
import feelings from "../../seed/feelings.json";
import items from "../../seed/items.json";
import persona from "../../seed/persona.json";
import plan from "../../seed/wear-plan.json";
import { addDays, SEED_DAYS, seedLastDay, seedOutfitLog, type DayPlan, type SeedFeeling, type SeedItem } from "./wear-seed.mjs";

const LAST_DAY = "2026-10-28";
// Seed pieces the persona's story is about (seed/items.json).
const BEIGE_TEE = "8e169881-6d10-4f5e-93b1-c00a1e1efe69";
const JEANS = "d54193d3-7afa-4da9-9af7-efc08b13427a";
const LOAFERS = "84709d1e-9f8a-4f71-ac84-43ecd8c7f603";
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

  it("logs most of the days, as real outfits", () => {
    const { rows } = run();
    expectValidRows(rows, CLOSET);
    expect(new Set(rows.map((r) => r.worn_on)).size).toBeGreaterThanOrEqual(Math.ceil(SEED_DAYS * 0.7));
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

  it("writes a day-by-day plan as it is", () => {
    const passedOn = { ...piece(16, "top"), status: "passing_on" };
    const { rows, roles } = run({
      items: [...CLOSET, passedOn],
      plan: {
        days: [
          { daysAgo: 0, outfits: [{ items: [id(2), id(5), id(9)], occasion: "school" }] },
          {
            daysAgo: 2,
            outfits: [
              { items: [id(16), id(7)], occasion: "home" },
              { items: [id(10), id(3), "not-in-closet"], occasion: "sport" },
              // The same pieces twice in a day, and nothing left: dropped.
              { items: [id(7), id(16)] },
              { items: ["not-in-closet"] },
            ],
          },
          // Outside the window: dropped.
          { daysAgo: SEED_DAYS, outfits: [{ items: [id(1)] }] },
        ],
      },
    });
    expect(roles.size).toBe(0);
    expect(rows.map((r) => [r.worn_on, r.item_ids, r.occasion])).toEqual([
      [addDays(LAST_DAY, -2), [id(16), id(7)].sort(), "home"],
      [addDays(LAST_DAY, -2), [id(10), id(3)].sort(), "sport"],
      [LAST_DAY, [id(2), id(5), id(9)].sort(), "school"],
    ]);
    expectValidRows(rows, [...CLOSET, passedOn]);
  });

  it("works on the seed closet as it is today, without a plan", () => {
    const { rows } = seedOutfitLog({
      personaId: persona.id,
      items: items as SeedItem[],
      feelings: feelings as SeedFeeling[],
      lifestyleMix: persona.lifestyle_mix,
      lastDay: LAST_DAY,
    });
    expectValidRows(rows, items as SeedItem[]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("tells the persona's story from seed/wear-plan.json", () => {
    const { rows } = seedOutfitLog({
      personaId: persona.id,
      items: items as SeedItem[],
      feelings: feelings as SeedFeeling[],
      lifestyleMix: persona.lifestyle_mix,
      plan: plan as DayPlan,
      lastDay: LAST_DAY,
    });
    expectValidRows(rows, items as SeedItem[]);
    expect(new Set(rows.map((r) => r.worn_on)).size).toBe(SEED_DAYS);
    const c = counts(rows);
    // The beige tee that "washes me out" is never worn.
    expect(c.get(BEIGE_TEE) ?? 0).toBe(0);
    // The jeans are the go-to for class.
    const school = rows.filter((r) => r.occasion === "school");
    expect(school.every((r) => r.item_ids.includes(JEANS))).toBe(true);
    // The loafers they praise, and both pieces now passed on, are worn once.
    for (const once of [LOAFERS, ...items.filter((i) => i.status === "passing_on").map((i) => i.id)]) {
      expect(c.get(once)).toBe(1);
    }
    for (const item of items.filter((i) => i.id !== BEIGE_TEE)) expect(c.get(item.id) ?? 0).toBeGreaterThan(0);
    // One running set does most of the sport days.
    const sport = rows.filter((r) => r.occasion === "sport").map((r) => r.item_ids.join());
    const top = Math.max(...[...new Set(sport)].map((k) => sport.filter((s) => s === k).length));
    expect(top).toBeGreaterThan(sport.length / 2);
  });
});

describe("seedLastDay", () => {
  it("ends yesterday in Chicago by default", () => {
    // 03:00 UTC on Nov 3 is still Nov 2 in Chicago.
    expect(seedLastDay(undefined, new Date("2026-11-03T03:00:00Z"))).toBe("2026-11-01");
    expect(seedLastDay("", new Date("2026-11-03T18:00:00Z"))).toBe("2026-11-02");
  });

  it("uses SEED_LAST_DAY when given, so the log covers the hackathon", () => {
    const last = seedLastDay("2026-11-04");
    expect(last).toBe("2026-11-04");
    expect(addDays(last, -(SEED_DAYS - 1))).toBe("2026-10-26");
  });

  it("refuses a value that isn't a real date", () => {
    for (const bad of ["2026-11-4", "2026-02-30", "2026-13-01", "Nov 4"]) {
      expect(() => seedLastDay(bad)).toThrow(/SEED_LAST_DAY/);
    }
  });
});
