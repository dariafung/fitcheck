// What the outfit log says over 30 days, counted in code. Always shown; the
// model's insights only come on top. Wear counts are outfits: a piece in
// two outfits on one day was worn twice.
import type { FeelingStructured, LifestyleMix, Occasion } from "@/lib/ai/schemas/common";
import { Occasion as OccasionEnum } from "@/lib/ai/schemas/common";
import { addDays, daysBetween } from "./day";

export const WINDOW_DAYS = 30;
// Fewer logged days than this and there's too little to read anything into.
export const MIN_LOGGED_DAYS = 7;
// Pieces added this recently aren't called unworn yet.
export const NEW_ITEM_DAYS = 7;
// "You complain, you wear it" needs at least this many outfits.
export const OFTEN_MIN = 4;
// "You love it, you skip it": at most this many.
export const RARELY_MAX = 1;
export const MOST_WORN_SHOWN = 3;

export interface LoggedOutfit {
  id: string;
  date: string;
  itemIds: string[];
  occasion: Occasion | null;
}

export interface WearItem {
  id: string;
  title: string;
  category: string;
  status: string;
  // The day it was added, "YYYY-MM-DD".
  addedOn: string;
  feeling: FeelingStructured | null;
}

export interface ItemWear {
  count: number;
  lastWorn: string | null;
}

export interface OccasionWear {
  occasion: Occasion;
  // Different outfits wanted per season (the profile's lifestyle mix).
  wanted: number;
  outfitsLogged: number;
  // Outfits that differ in at least one piece.
  distinctOutfits: number;
}

export interface WearStats {
  // The 30 days counted, ending on the last day with a log.
  from: string;
  to: string;
  loggedDays: number;
  outfitCount: number;
  byItem: Map<string, ItemWear>;
  mostWorn: string[];
  notWorn: string[];
  lovedSkipped: string[];
  complainedWorn: string[];
  occasions: OccasionWear[];
}

// The window ends on the latest day with a log, so a log nobody adds to
// (the demo's) never goes empty. Null with no log at all.
export function wearWindow(latest: string | null): { from: string; to: string } | null {
  return latest ? { from: addDays(latest, -(WINDOW_DAYS - 1)), to: latest } : null;
}

function praises(f: FeelingStructured | null): boolean {
  return f !== null && (f.liked === "yes" || f.flattering === "yes");
}

function complains(f: FeelingStructured | null): boolean {
  if (!f) return false;
  if (f.liked === "no" || f.flattering === "no") return true;
  return f.liked !== "yes" && f.aspects.some((a) => a.sentiment === "negative");
}

// Outfits outside the window and pieces that aren't this user's active ones
// are left out. Lists are item ids, most telling first.
export function wearStats(
  outfits: readonly LoggedOutfit[],
  items: readonly WearItem[],
  mix: LifestyleMix | null,
  window: { from: string; to: string },
): WearStats {
  const active = items.filter((i) => i.status === "active");
  const activeIds = new Set(active.map((i) => i.id));
  const inWindow = outfits.filter((o) => o.date >= window.from && o.date <= window.to);

  const byItem = new Map<string, ItemWear>(active.map((i) => [i.id, { count: 0, lastWorn: null }]));
  for (const outfit of inWindow) {
    for (const id of outfit.itemIds) {
      const wear = byItem.get(id);
      if (!wear) continue;
      wear.count += 1;
      if (!wear.lastWorn || outfit.date > wear.lastWorn) wear.lastWorn = outfit.date;
    }
  }
  const count = (id: string) => byItem.get(id)?.count ?? 0;
  const byCount = (a: WearItem, b: WearItem) =>
    count(b.id) - count(a.id) || (byItem.get(b.id)?.lastWorn ?? "").localeCompare(byItem.get(a.id)?.lastWorn ?? "") || a.title.localeCompare(b.title);

  // Worn at least as often as half the pieces of its kind.
  const oftenForItsKind = (item: WearItem) => {
    const counts = active.filter((i) => i.category === item.category).map((i) => count(i.id)).sort((a, b) => b - a);
    return count(item.id) >= counts[Math.floor((counts.length - 1) / 2)];
  };

  return {
    ...window,
    loggedDays: new Set(inWindow.map((o) => o.date)).size,
    outfitCount: inWindow.length,
    byItem,
    mostWorn: active.filter((i) => count(i.id) > 0).sort(byCount).slice(0, MOST_WORN_SHOWN).map((i) => i.id),
    notWorn: active
      .filter((i) => count(i.id) === 0 && daysBetween(i.addedOn, window.to) >= NEW_ITEM_DAYS)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((i) => i.id),
    lovedSkipped: active
      .filter((i) => praises(i.feeling) && count(i.id) <= RARELY_MAX && daysBetween(i.addedOn, window.to) >= NEW_ITEM_DAYS)
      .sort((a, b) => count(a.id) - count(b.id) || a.title.localeCompare(b.title))
      .map((i) => i.id),
    complainedWorn: active
      .filter((i) => complains(i.feeling) && count(i.id) >= OFTEN_MIN && oftenForItsKind(i))
      .sort(byCount)
      .map((i) => i.id),
    occasions: occasionWear(
      inWindow.map((o) => ({ ...o, itemIds: o.itemIds.filter((id) => activeIds.has(id)) })),
      mix,
    ),
  };
}

// Every occasion the user wants outfits for or has logged one for.
function occasionWear(outfits: readonly LoggedOutfit[], mix: LifestyleMix | null): OccasionWear[] {
  return OccasionEnum.options.flatMap((occasion) => {
    const logged = outfits.filter((o) => o.occasion === occasion);
    const wanted = mix?.[occasion] ?? 0;
    if (wanted === 0 && logged.length === 0) return [];
    const distinct = new Set(logged.map((o) => [...o.itemIds].sort().join("+")));
    return [{ occasion, wanted, outfitsLogged: logged.length, distinctOutfits: distinct.size }];
  });
}
