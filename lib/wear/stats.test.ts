import { describe, expect, it } from "vitest";
import type { FeelingStructured } from "@/lib/ai/schemas/common";
import { addDays } from "./day";
import { wearStats, wearWindow, type LoggedOutfit, type WearItem } from "./stats";

const END = "2026-10-28";
const WINDOW = wearWindow(END)!;
const OLD = "2026-08-01";

const feeling = (overrides: Partial<FeelingStructured>): FeelingStructured => ({
  flattering: "unknown",
  liked: "unknown",
  aspects: [],
  occasions: [],
  mood: [],
  summary: "",
  ...overrides,
});

const item = (id: string, category: string, extra: Partial<WearItem> = {}): WearItem => ({
  id,
  title: `Item ${id}`,
  category,
  status: "active",
  addedOn: OLD,
  feeling: null,
  ...extra,
});

let n = 0;
const outfit = (date: string, itemIds: string[], occasion: LoggedOutfit["occasion"] = null): LoggedOutfit => ({
  id: `o${n++}`,
  date,
  itemIds,
  occasion,
});

// Worn on `count` different days ending at END.
const days = (count: number, itemIds: string[], occasion: LoggedOutfit["occasion"] = null) =>
  Array.from({ length: count }, (_, i) => outfit(addDays(END, -i), itemIds, occasion));

describe("wearWindow", () => {
  it("is the 30 days up to the last logged day, or nothing", () => {
    expect(WINDOW).toEqual({ from: "2026-09-29", to: END });
    expect(wearWindow(null)).toBeNull();
  });
});

describe("wearStats", () => {
  it("counts outfits, so two outfits on one day count twice", () => {
    const stats = wearStats(
      [outfit(END, ["shoes"], "school"), outfit(END, ["shoes", "tee"], "sport")],
      [item("shoes", "shoes"), item("tee", "top")],
      null,
      WINDOW,
    );
    expect(stats.byItem.get("shoes")).toEqual({ count: 2, lastWorn: END });
    expect(stats.loggedDays).toBe(1);
    expect(stats.outfitCount).toBe(2);
  });

  it("leaves out outfits outside the window and pieces no longer worn or gone", () => {
    const stats = wearStats(
      [outfit(addDays(WINDOW.from, -1), ["a"]), outfit(END, ["a", "passed", "deleted"])],
      [item("a", "top"), item("passed", "bottom", { status: "passing_on" })],
      null,
      WINDOW,
    );
    expect(stats.byItem.get("a")?.count).toBe(1);
    expect(stats.byItem.has("passed")).toBe(false);
    expect(stats.byItem.has("deleted")).toBe(false);
  });

  it("ranks the most worn and lists the unworn, but not pieces added this week", () => {
    const stats = wearStats(
      [...days(5, ["jeans"]), ...days(2, ["tee"])],
      [item("jeans", "bottom"), item("tee", "top"), item("coat", "outerwear"), item("new", "top", { addedOn: addDays(END, -3) })],
      null,
      WINDOW,
    );
    expect(stats.mostWorn).toEqual(["jeans", "tee"]);
    expect(stats.notWorn).toEqual(["coat"]);
  });

  it("finds what they praise but skip, and what they knock but wear", () => {
    const items = [
      item("dress", "one_piece", { feeling: feeling({ liked: "yes", flattering: "yes" }) }),
      item("jeans", "bottom", { feeling: feeling({ liked: "no" }) }),
      item("chinos", "bottom"),
      item("shirt", "top", {
        // Liked despite a gripe: not a complaint.
        feeling: feeling({ liked: "yes", aspects: [{ aspect: "fit", sentiment: "negative", said: "tight", means: "tight" }] }),
      }),
    ];
    const stats = wearStats([...days(8, ["jeans", "shirt"]), ...days(1, ["chinos"]), outfit(END, ["dress"])], items, null, WINDOW);
    expect(stats.lovedSkipped).toEqual(["dress"]);
    expect(stats.complainedWorn).toEqual(["jeans"]);
  });

  it("only calls a knocked piece worn a lot when it's worn as much as most of its kind", () => {
    const items = [
      item("jeans", "bottom", { feeling: feeling({ flattering: "no" }) }),
      item("chinos", "bottom"),
      item("skirt", "bottom"),
    ];
    const stats = wearStats([...days(4, ["jeans"]), ...days(10, ["chinos"]), ...days(10, ["skirt"])], items, null, WINDOW);
    expect(stats.complainedWorn).toEqual([]);
  });

  it("counts outfits and different outfits per occasion against the lifestyle mix", () => {
    const stats = wearStats(
      [...days(3, ["tee", "shorts"], "sport"), outfit(END, ["tee", "jeans"], "sport"), outfit(END, ["shirt"], null)],
      [item("tee", "top"), item("shorts", "bottom"), item("jeans", "bottom"), item("shirt", "top")],
      { work: 0, school: 3, social: 0, sport: 3, home: 0 },
      WINDOW,
    );
    expect(stats.occasions).toEqual([
      { occasion: "school", wanted: 3, outfitsLogged: 0, distinctOutfits: 0 },
      { occasion: "sport", wanted: 3, outfitsLogged: 4, distinctOutfits: 2 },
    ]);
  });
});
