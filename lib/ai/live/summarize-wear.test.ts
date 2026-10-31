import { describe, expect, it } from "vitest";
import { SummarizeWearInput } from "../schemas/summarize-wear";
import { toWearOutput, wearPrompt } from "./summarize-wear";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const INPUT = SummarizeWearInput.parse({
  windowDays: 30,
  loggedDays: 26,
  outfitCount: 31,
  items: [
    {
      id: ID(1),
      title: "Dark jeans",
      tags: { category: "bottom", colors: [{ name: "indigo" }], materials: ["denim"], formality: 2, occasions: [] },
      wornCount: 11,
      lastWornDaysAgo: 0,
      addedDaysAgo: null,
      feeling: {
        flattering: "no",
        liked: "no",
        aspects: [{ aspect: "fit", sentiment: "negative", area: "waist", said: "digs in when I sit", means: "needs room" }],
      },
    },
    {
      id: ID(2),
      title: "Green dress",
      tags: { category: "one_piece", colors: [{ name: "green" }], materials: [], formality: 3, occasions: [] },
      wornCount: 0,
      lastWornDaysAgo: null,
      addedDaysAgo: 4,
      feeling: null,
    },
  ],
  occasions: [{ occasion: "sport", wanted: 3, outfitsLogged: 4, distinctOutfits: 1 }],
});

describe("wearPrompt", () => {
  it("numbers the items and spells out counts, feelings and occasions", () => {
    const prompt = wearPrompt(INPUT);
    expect(prompt).toContain("Log: last 30 days, 26 days logged, 31 outfits.");
    expect(prompt).toContain("sport: wants 3 different outfits a season; logged 4 outfits, 1 different");
    expect(prompt).toMatch(/I1: Dark jeans: bottom.*\n {2}worn in 11 outfits, last on the final day\n {2}felt: flattering no, liked no; - fit \(waist\): digs in when I sit/);
    expect(prompt).toContain("I2: Green dress");
    expect(prompt).toContain("not worn (added 4 days before the end)");
  });

  it("lists pieces owned all along and never worn, and the most worn, so the model doesn't count", () => {
    expect(wearPrompt(INPUT)).toContain("Not worn: none\nMost worn: I1 (11 outfits each)");
    const old = SummarizeWearInput.parse({ ...INPUT, items: [INPUT.items[0], { ...INPUT.items[1], addedDaysAgo: null }] });
    expect(wearPrompt(old)).toContain("Not worn: I2\n");
    const none = SummarizeWearInput.parse({ ...INPUT, items: [{ ...INPUT.items[0], wornCount: 0, lastWornDaysAgo: null }] });
    expect(wearPrompt(none)).toContain("Not worn: I1\nMost worn: none");
  });
});

describe("toWearOutput", () => {
  it("maps item numbers to ids and drops numbers outside the list", () => {
    const out = toWearOutput(INPUT, {
      insights: [
        { kind: "say_vs_wear", text: " You knock the jeans but wore them 11 times. ", items: [1, 1, 9] },
        { kind: "occasion", text: "Sport is always the same outfit.", items: [] },
      ],
    });
    expect(out).toEqual({
      insights: [
        { kind: "say_vs_wear", text: "You knock the jeans but wore them 11 times.", itemIds: [ID(1)] },
        { kind: "occasion", text: "Sport is always the same outfit.", itemIds: [] },
      ],
    });
  });

  it("drops insights with no real item, and answers null when none are left", () => {
    expect(toWearOutput(INPUT, { insights: [{ kind: "idle", text: "Nothing.", items: [7] }] })).toBeNull();
    expect(toWearOutput(INPUT, { insights: [] })).toBeNull();
  });

  it("keeps at most three", () => {
    const four = Array.from({ length: 4 }, (_, i) => ({ kind: "favorite" as const, text: `T${i}`, items: [1] }));
    expect(toWearOutput(INPUT, { insights: four })?.insights).toHaveLength(3);
  });
});
