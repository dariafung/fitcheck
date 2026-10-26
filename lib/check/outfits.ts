// Enumerates complete outfits from a compatibility graph: top + bottom +
// shoes, or one-piece + shoes, each optionally with outerwear. Every pair
// inside an outfit must be compatible. Accessories never count.
//
// Cost: with T tops, B bottoms, P one-pieces, S shoes and W outerwear the
// worst case (everything compatible) is (T·B·S + P·S)·(1 + W) outfits, e.g.
// a 20-item closet (6/5/2/4/3) gives at most (120 + 8)·4 = 512. Loops prune
// on incompatible pairs, so real closets stay far below that. Counts are
// always exact; only the returned list is capped at MAX_OUTFITS.
import { Occasion } from "../ai/schemas/common";
import { TEMP_F_MAX, type TempRangeF } from "../temperature";
import { COVERED_BY_OUTERWEAR, tempRangeOf } from "./rules";
import { categoryOf, pairKey, type ClosetItem, type Compatible } from "./types";

// Below this (°F) an outfit needs outerwear: the bare version's range is cut here.
export const OUTERWEAR_REQUIRED_BELOW_F = 45;

// Most outfits returned in one list; counts keep going past it.
export const MAX_OUTFITS = 10_000;

export interface Outfit {
  // Item ids joined with "+", in slot order.
  id: string;
  // Slot order: top, bottom, shoes[, outerwear] or one-piece, shoes[, outerwear].
  itemIds: string[];
  tempRangeF: TempRangeF;
  occasions: Occasion[];
}

export interface OutfitSummary {
  total: number;
  byOccasion: Record<Occasion, number>;
  // Outfit count for every non-accessory item passed in, zeros included.
  byItem: Record<string, number>;
}

export interface OutfitSet {
  outfits: Outfit[];
  summary: OutfitSummary;
  // True when more than MAX_OUTFITS exist; the summary still counts all.
  truncated: boolean;
}

interface OutfitDraft {
  pieces: ClosetItem[];
  tempRangeF: TempRangeF;
}

function byId(a: ClosetItem, b: ClosetItem): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Unique by id, accessories dropped, sorted so results don't depend on input order.
function eligibleItems(items: readonly ClosetItem[]): ClosetItem[] {
  const seen = new Map<string, ClosetItem>();
  for (const item of items) {
    if (categoryOf(item) !== "accessory") seen.set(item.id, item);
  }
  return [...seen.values()].sort(byId);
}

function intersect(ranges: readonly TempRangeF[]): TempRangeF | null {
  const min = Math.max(...ranges.map((r) => r.min));
  const max = Math.min(...ranges.map((r) => r.max));
  return min <= max ? { min, max } : null;
}

// Without outerwear: every piece's range, cut at OUTERWEAR_REQUIRED_BELOW_F.
export function bareTempRange(pieces: readonly ClosetItem[]): TempRangeF | null {
  const needsNoLayer = { min: OUTERWEAR_REQUIRED_BELOW_F, max: TEMP_F_MAX };
  return intersect([needsNoLayer, ...pieces.map(tempRangeOf)]);
}

// With outerwear: the low end is set by the layer and the exposed pieces
// (bottom, shoes), since the top or one-piece sits under the layer; the high
// end by every piece, layer included.
export function layeredTempRange(
  base: readonly ClosetItem[],
  layer: ClosetItem,
): TempRangeF | null {
  const exposed = base.filter((p) => !COVERED_BY_OUTERWEAR.includes(categoryOf(p)));
  const min = Math.max(...[layer, ...exposed].map((p) => tempRangeOf(p).min));
  const max = Math.min(...[layer, ...base].map((p) => tempRangeOf(p).max));
  return min <= max ? { min, max } : null;
}

// An outfit belongs to an occasion when more than half its pieces carry that
// tag; outerwear counts as a piece (2 of 3, 3 of 4, 2 of 2).
export function outfitOccasions(pieces: readonly ClosetItem[]): Occasion[] {
  return Occasion.options.filter(
    (occasion) =>
      pieces.filter((p) => p.tags.occasions.includes(occasion)).length * 2 >
      pieces.length,
  );
}

function* baseOutfits(
  items: ClosetItem[],
  compatible: Compatible,
): Generator<ClosetItem[]> {
  const of = (category: string) => items.filter((i) => categoryOf(i) === category);
  const shoes = of("shoes");
  const bottoms = of("bottom");
  for (const top of of("top")) {
    for (const bottom of bottoms) {
      if (!compatible(top, bottom)) continue;
      for (const shoe of shoes) {
        if (compatible(top, shoe) && compatible(bottom, shoe)) {
          yield [top, bottom, shoe];
        }
      }
    }
  }
  for (const onePiece of of("one_piece")) {
    for (const shoe of shoes) {
      if (compatible(onePiece, shoe)) yield [onePiece, shoe];
    }
  }
}

function* outfitDrafts(
  items: ClosetItem[],
  compatible: Compatible,
): Generator<OutfitDraft> {
  const outerwear = items.filter((i) => categoryOf(i) === "outerwear");
  for (const base of baseOutfits(items, compatible)) {
    const bare = bareTempRange(base);
    if (bare) yield { pieces: base, tempRangeF: bare };
    for (const layer of outerwear) {
      if (!base.every((piece) => compatible(layer, piece))) continue;
      const layered = layeredTempRange(base, layer);
      if (layered) yield { pieces: [...base, layer], tempRangeF: layered };
    }
  }
}

export function enumerateOutfits(
  items: readonly ClosetItem[],
  compatible: Compatible,
  limit = MAX_OUTFITS,
): OutfitSet {
  const eligible = eligibleItems(items);
  const byItem: Record<string, number> = {};
  for (const item of eligible) byItem[item.id] = 0;
  const byOccasion = Object.fromEntries(
    Occasion.options.map((o) => [o, 0]),
  ) as Record<Occasion, number>;

  const outfits: Outfit[] = [];
  let total = 0;
  for (const { pieces, tempRangeF } of outfitDrafts(eligible, compatible)) {
    total += 1;
    for (const piece of pieces) byItem[piece.id] += 1;
    const occasions = outfitOccasions(pieces);
    for (const occasion of occasions) byOccasion[occasion] += 1;
    if (outfits.length < limit) {
      const itemIds = pieces.map((p) => p.id);
      outfits.push({ id: itemIds.join("+"), itemIds, tempRangeF, occasions });
    }
  }
  return {
    outfits,
    summary: { total, byOccasion, byItem },
    truncated: total > outfits.length,
  };
}

// Every pair that appears in at least one outfit under `compatible`. Run with
// the rule filter, it lists the only pairs worth asking the model about.
export function pairsInOutfits(
  items: readonly ClosetItem[],
  compatible: Compatible,
): Map<string, [ClosetItem, ClosetItem]> {
  const pairs = new Map<string, [ClosetItem, ClosetItem]>();
  for (const { pieces } of outfitDrafts(eligibleItems(items), compatible)) {
    for (let i = 0; i < pieces.length; i += 1) {
      for (let j = i + 1; j < pieces.length; j += 1) {
        const key = pairKey(pieces[i].id, pieces[j].id);
        if (!pairs.has(key)) pairs.set(key, [pieces[i], pieces[j]]);
      }
    }
  }
  return new Map([...pairs].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
