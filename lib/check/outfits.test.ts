import { describe, expect, it } from "vitest";
import type { Category } from "../ai/schemas/common";
import { makeItem, SAMPLE_CLOSET, type FixtureTags } from "./fixtures";
import {
  bareTempRange,
  enumerateOutfits,
  layeredTempRange,
  OUTERWEAR_REQUIRED_BELOW_F,
  outfitOccasions,
  pairsInOutfits,
} from "./outfits";
import { checkRules } from "./rules";
import { pairKey, type ClosetItem, type Compatible } from "./types";

let next = 0;
function item(category: Category, over: Partial<FixtureTags> = {}): ClosetItem {
  next += 1;
  const id = `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
  return makeItem(id, `${category} ${next}`, { category, formality: 3, occasions: [], ...over });
}
const temp = (min: number, max: number) => ({ tempRangeF: { min, max } });

const always: Compatible = () => true;
// Compatible except for the listed pairs.
function except(...pairs: [ClosetItem, ClosetItem][]): Compatible {
  const blocked = new Set(pairs.map(([a, b]) => pairKey(a.id, b.id)));
  return (a, b) => !blocked.has(pairKey(a.id, b.id));
}

describe("enumerateOutfits", () => {
  it("builds top + bottom + shoes", () => {
    const [t, b, s] = [item("top"), item("bottom"), item("shoes")];
    const { outfits, summary } = enumerateOutfits([s, b, t], always);
    expect(outfits.map((o) => o.itemIds)).toEqual([[t.id, b.id, s.id]]);
    expect(outfits[0].id).toBe(`${t.id}+${b.id}+${s.id}`);
    expect(summary.total).toBe(1);
    expect(summary.byItem).toEqual({ [t.id]: 1, [b.id]: 1, [s.id]: 1 });
  });

  it("finds nothing without shoes, but still lists every item at 0", () => {
    const items = [item("top"), item("bottom"), item("one_piece"), item("outerwear")];
    const { outfits, summary } = enumerateOutfits(items, always);
    expect(outfits).toEqual([]);
    expect(summary.total).toBe(0);
    expect(Object.values(summary.byItem)).toEqual([0, 0, 0, 0]);
  });

  it("builds one-piece + shoes when there are no tops or bottoms", () => {
    const [d, s1, s2] = [item("one_piece"), item("shoes"), item("shoes")];
    const { outfits } = enumerateOutfits([d, s1, s2], except([d, s2]));
    expect(outfits.map((o) => o.itemIds)).toEqual([[d.id, s1.id]]);
  });

  it("needs a top and a bottom for a separates outfit", () => {
    expect(enumerateOutfits([item("top"), item("shoes")], always).summary.total).toBe(0);
    expect(enumerateOutfits([item("bottom"), item("shoes")], always).summary.total).toBe(0);
  });

  it("needs every pair inside the outfit to be compatible", () => {
    const [t, b, s] = [item("top"), item("bottom"), item("shoes")];
    expect(enumerateOutfits([t, b, s], except([t, b])).summary.total).toBe(0);
    expect(enumerateOutfits([t, b, s], except([t, s])).summary.total).toBe(0);
    expect(enumerateOutfits([t, b, s], except([b, s])).summary.total).toBe(0);
  });

  it("ignores accessories entirely", () => {
    const [t, b, s, a] = [item("top"), item("bottom"), item("shoes"), item("accessory")];
    const { outfits, summary } = enumerateOutfits([t, b, s, a], always);
    expect(outfits).toHaveLength(1);
    expect(summary.byItem).not.toHaveProperty(a.id);
  });

  it("drops outfits whose ranges don't all overlap", () => {
    // The graph here ignores the rules, so only the outfit range decides.
    const t = item("top", temp(50, 70));
    const b = item("bottom", temp(65, 90));
    const s = item("shoes", temp(45, 66));
    expect(enumerateOutfits([t, b, s], always).summary.total).toBe(1);
    const s2 = item("shoes", temp(50, 64));
    expect(enumerateOutfits([t, b, s2], always).summary.total).toBe(0);
  });

  it("gives each outfit the shared range", () => {
    const pieces = [item("top", temp(55, 85)), item("bottom", temp(20, 80)), item("shoes", temp(40, 90))];
    expect(enumerateOutfits(pieces, always).outfits[0].tempRangeF).toEqual({ min: 55, max: 80 });
  });

  it("returns items in a stable order whatever the input order", () => {
    const items = [
      item("top"), item("top"), item("bottom"), item("bottom"),
      item("shoes"), item("one_piece"), item("outerwear"),
    ];
    const shuffled = [items[4], items[6], items[0], items[3], items[5], items[1], items[2], items[0]];
    expect(enumerateOutfits(shuffled, always)).toEqual(enumerateOutfits(items, always));
  });

  it("caps the list but keeps counting", () => {
    const items = [item("top"), item("top"), item("bottom"), item("shoes"), item("shoes")];
    const capped = enumerateOutfits(items, always, 3);
    expect(capped.outfits).toHaveLength(3);
    expect(capped.truncated).toBe(true);
    expect(capped.summary.total).toBe(4);
    expect(enumerateOutfits(items, always).truncated).toBe(false);
  });
});

describe("outerwear by temperature", () => {
  it("counts a bare outfit only down to OUTERWEAR_REQUIRED_BELOW_F", () => {
    const sweater = item("top", temp(30, 60));
    const jeans = item("bottom", temp(20, 80));
    const boots = item("shoes", temp(10, 60));
    expect(bareTempRange([sweater, jeans, boots])).toEqual({ min: OUTERWEAR_REQUIRED_BELOW_F, max: 60 });
    const thermal = item("one_piece", temp(-10, OUTERWEAR_REQUIRED_BELOW_F - 1));
    expect(bareTempRange([thermal, boots])).toBeNull();
    expect(enumerateOutfits([thermal, boots], always).summary.total).toBe(0);
  });

  it("lets outerwear take the covered top below its own range", () => {
    const tee = item("top", temp(60, 95));
    const jeans = item("bottom", temp(20, 80));
    const boots = item("shoes", temp(10, 60));
    const coat = item("outerwear", temp(10, 50));
    const { outfits } = enumerateOutfits([tee, jeans, boots, coat], always);
    expect(outfits.map((o) => [o.itemIds.length, o.tempRangeF])).toEqual([
      [3, { min: 60, max: 60 }],
      [4, { min: 20, max: 50 }],
    ]);
  });

  it("is limited by exposed bottoms and shoes, and by every piece's max", () => {
    const tee = item("top", temp(60, 95));
    const coat = item("outerwear", temp(0, 50));
    const sneakers = item("shoes", temp(40, 90));
    expect(layeredTempRange([tee, item("bottom", temp(30, 80)), sneakers], coat)).toEqual({ min: 40, max: 50 });
    expect(layeredTempRange([tee, item("bottom", temp(30, 45)), sneakers], coat)).toEqual({ min: 40, max: 45 });
    expect(layeredTempRange([tee, item("bottom", temp(55, 80)), sneakers], coat)).toBeNull();
  });

  it("treats a one-piece as covered too", () => {
    const dress = item("one_piece", temp(65, 90));
    const boots = item("shoes", temp(10, 60));
    expect(layeredTempRange([dress, boots], item("outerwear", temp(0, 50)))).toEqual({ min: 10, max: 50 });
  });

  it("counts a too-cold-to-go-bare outfit only with outerwear", () => {
    const sweater = item("top", temp(20, 44));
    const trousers = item("bottom", temp(10, 60));
    const boots = item("shoes", temp(0, 50));
    const coat = item("outerwear", temp(-10, 40));
    expect(enumerateOutfits([sweater, trousers, boots], always).summary.total).toBe(0);
    const { outfits } = enumerateOutfits([sweater, trousers, boots, coat], always);
    expect(outfits.map((o) => o.itemIds)).toEqual([[sweater.id, trousers.id, boots.id, coat.id]]);
    expect(outfits[0].tempRangeF).toEqual({ min: 10, max: 40 });
  });

  it("treats items without a range as any temperature", () => {
    const pieces = [item("top"), item("bottom"), item("shoes")];
    expect(bareTempRange(pieces)).toEqual({ min: OUTERWEAR_REQUIRED_BELOW_F, max: 110 });
    expect(layeredTempRange(pieces, item("outerwear"))).toEqual({ min: -20, max: 110 });
  });

  it("needs outerwear to be compatible with every piece", () => {
    const [t, b, s, coat] = [item("top"), item("bottom"), item("shoes"), item("outerwear")];
    for (const piece of [t, b, s]) {
      const { outfits } = enumerateOutfits([t, b, s, coat], except([coat, piece]));
      expect(outfits.map((o) => o.itemIds.length)).toEqual([3]);
    }
  });

  it("tries each outerwear piece separately", () => {
    const [d, s, c1, c2] = [item("one_piece"), item("shoes"), item("outerwear"), item("outerwear")];
    const { summary } = enumerateOutfits([d, s, c1, c2], always);
    expect(summary.total).toBe(3);
    expect(summary.byItem[c1.id]).toBe(1);
    expect(summary.byItem[d.id]).toBe(3);
  });
});

describe("occasions: more than half the pieces", () => {
  const tagged = (category: Category, work: boolean) =>
    item(category, { occasions: work ? ["work"] : ["home"] });

  it("needs 2 of 3", () => {
    expect(outfitOccasions([tagged("top", true), tagged("bottom", true), tagged("shoes", false)])).toEqual(["work"]);
    expect(outfitOccasions([tagged("top", true), tagged("bottom", false), tagged("shoes", false)])).toEqual(["home"]);
  });

  it("counts outerwear as a piece: needs 3 of 4", () => {
    const three = [tagged("top", true), tagged("bottom", true), tagged("shoes", true), tagged("outerwear", false)];
    expect(outfitOccasions(three)).toEqual(["work"]);
    const two = [tagged("top", true), tagged("bottom", true), tagged("shoes", false), tagged("outerwear", false)];
    expect(outfitOccasions(two)).toEqual([]);
  });

  it("needs both pieces of one-piece + shoes", () => {
    expect(outfitOccasions([tagged("one_piece", true), tagged("shoes", true)])).toEqual(["work"]);
    expect(outfitOccasions([tagged("one_piece", true), tagged("shoes", false)])).toEqual([]);
  });

  it("can give an outfit several occasions, and adds them to the summary", () => {
    const both = { occasions: ["work" as const, "social" as const] };
    const items = [item("top", both), item("bottom", both), item("shoes", { occasions: ["social"] })];
    const { outfits, summary } = enumerateOutfits(items, always);
    expect(outfits[0].occasions).toEqual(["work", "social"]);
    expect(summary.byOccasion).toEqual({ work: 1, social: 1, sport: 0, home: 0 });
  });
});

describe("pairsInOutfits", () => {
  it("lists only pairs that sit in some outfit", () => {
    const [t, b, s, d] = [item("top"), item("bottom"), item("shoes"), item("one_piece")];
    const pairs = pairsInOutfits([t, b, s, d], always);
    expect([...pairs.keys()].sort()).toEqual(
      [pairKey(t.id, b.id), pairKey(t.id, s.id), pairKey(b.id, s.id), pairKey(d.id, s.id)].sort(),
    );
  });

  it("is empty for a closet without shoes", () => {
    expect(pairsInOutfits([item("top"), item("bottom"), item("outerwear")], always).size).toBe(0);
  });
});

describe("sample closet under the rules alone", () => {
  const passes: Compatible = (a, b) => checkRules(a, b).pass;

  it("only builds outfits whose every pair passes the rules", () => {
    const byId = new Map(SAMPLE_CLOSET.map((i) => [i.id, i]));
    const { outfits, summary } = enumerateOutfits(SAMPLE_CLOSET, passes);
    expect(summary.total).toBeGreaterThan(0);
    for (const outfit of outfits) {
      const pieces = outfit.itemIds.map((id) => byId.get(id)!);
      for (let i = 0; i < pieces.length; i += 1) {
        for (let j = i + 1; j < pieces.length; j += 1) {
          expect(checkRules(pieces[i], pieces[j]).pass).toBe(true);
        }
      }
    }
  });
});
