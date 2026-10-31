import { describe, expect, it } from "vitest";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { addDays } from "./day";
import { daysToGo, wearHash, wearInput } from "./insights";
import type { WearLog, WearLogItem } from "./log";
import { MIN_LOGGED_DAYS, wearStats, wearWindow, type LoggedOutfit } from "./stats";

const END = "2026-10-28";
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tags = (category: ItemTags["category"]): ItemTags => ({
  category,
  colors: [{ name: "white" }],
  materials: ["cotton"],
  formality: 2,
  occasions: [],
});
const item = (n: number, extra: Partial<WearLogItem> = {}): WearLogItem => ({
  id: ID(n),
  title: `Item ${n}`,
  category: "top",
  status: "active",
  addedOn: "2026-08-01",
  feeling: null,
  tags: tags("top"),
  ...extra,
});

function log(loggedDays: number, items: WearLogItem[]): WearLog {
  const outfits: LoggedOutfit[] = Array.from({ length: loggedDays }, (_, i) => ({
    id: `o${i}`,
    date: addDays(END, -i),
    itemIds: [ID(1)],
    occasion: null,
  }));
  const window = wearWindow(loggedDays > 0 ? END : null);
  return { items, outfits, stats: window && wearStats(outfits, items, null, window) };
}

describe("wearInput", () => {
  it("waits for a week of logs", () => {
    expect(wearInput(log(MIN_LOGGED_DAYS - 1, [item(1)]))).toBeNull();
    expect(daysToGo(log(MIN_LOGGED_DAYS - 1, [item(1)]))).toBe(1);
    expect(daysToGo(log(0, [item(1)]))).toBe(MIN_LOGGED_DAYS);
    expect(wearInput(log(MIN_LOGGED_DAYS, [item(1)]))).not.toBeNull();
  });

  it("gives the model counts and days back, never dates, sorted by id", () => {
    const input = wearInput(
      log(MIN_LOGGED_DAYS, [
        item(2, { addedOn: addDays(END, -5) }),
        item(1, { feeling: { flattering: "yes", liked: "yes", aspects: [], occasions: [], mood: ["calm"], summary: "Nice." } }),
        item(3, { status: "passing_on" }),
      ]),
    )!;
    expect(input.items.map((i) => i.id)).toEqual([ID(1), ID(2)]);
    expect(input.items[0]).toMatchObject({ wornCount: MIN_LOGGED_DAYS, lastWornDaysAgo: 0, addedDaysAgo: null });
    // Only what bears on wearing it: no summary or mood.
    expect(input.items[0].feeling).toEqual({ flattering: "yes", liked: "yes", aspects: [] });
    expect(input.items[1]).toMatchObject({ wornCount: 0, lastWornDaysAgo: null, addedDaysAgo: 5 });
    expect(JSON.stringify(input)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("hashes the same log the same way, and a new outfit differently", () => {
    const a = wearInput(log(MIN_LOGGED_DAYS, [item(1)]))!;
    const b = wearInput(log(MIN_LOGGED_DAYS, [item(1)]))!;
    const c = wearInput(log(MIN_LOGGED_DAYS + 1, [item(1)]))!;
    expect(wearHash(a)).toBe(wearHash(b));
    expect(wearHash(c)).not.toBe(wearHash(a));
  });
});
