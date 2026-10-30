// Loads what the stats and the insights are worked out from: the user's
// items with their feelings, the lifestyle mix, and the 30 days of outfits.
import { FeelingStructured, LifestyleMix, type ItemTags } from "@/lib/ai/schemas/common";
import { itemTags } from "@/lib/closet/tags";
import type { Db } from "@/lib/db/server";
import { addDays, chicagoDay } from "./day";
import { latestLoggedDay, listOutfits } from "./outfits";
import { wearStats, wearWindow, type LoggedOutfit, type WearItem, type WearStats } from "./stats";

export interface WearLogItem extends WearItem {
  tags: ItemTags;
}

export interface WearLog {
  items: WearLogItem[];
  // The window's outfits, oldest first.
  outfits: LoggedOutfit[];
  // Null with nothing logged yet.
  stats: WearStats | null;
}

// Days are judged in Chicago; a day ahead is still counted, since the
// browser that logged it may be further east.
export async function loadWearLog(db: Db, userId: string, now = new Date()): Promise<WearLog> {
  const latest = await latestLoggedDay(db, userId, addDays(chicagoDay(now), 1));
  const window = wearWindow(latest);
  const [{ data: rows }, { data: feelings }, { data: user }, outfits] = await Promise.all([
    db
      .from("items")
      .select("id, title, category, status, ai_tags, user_tags, created_at")
      .eq("user_id", userId)
      .order("id")
      .throwOnError(),
    db
      .from("item_feelings")
      .select("item_id, structured")
      .eq("user_id", userId)
      .not("structured", "is", null)
      .order("created_at", { ascending: false })
      .throwOnError(),
    db.from("users").select("lifestyle_mix").eq("id", userId).maybeSingle().throwOnError(),
    window ? listOutfits(db, userId, window.from, window.to) : Promise.resolve([]),
  ]);

  const feelingOf = new Map<string, FeelingStructured>();
  for (const row of feelings) {
    if (feelingOf.has(row.item_id)) continue;
    const parsed = FeelingStructured.safeParse(row.structured);
    if (parsed.success) feelingOf.set(row.item_id, parsed.data);
  }
  const items = rows.map(
    (row): WearLogItem => ({
      id: row.id,
      title: row.title,
      category: row.category,
      status: row.status,
      addedOn: chicagoDay(new Date(row.created_at)),
      feeling: feelingOf.get(row.id) ?? null,
      tags: itemTags(row),
    }),
  );
  const mix = LifestyleMix.safeParse(user?.lifestyle_mix);
  return { items, outfits, stats: window && wearStats(outfits, items, mix.success ? mix.data : null, window) };
}

export interface ItemWearLine {
  count: number;
  lastWorn: string | null;
  window: { from: string; to: string };
}

// One item's wear over the same 30 days the calendar counts. Null with
// nothing logged at all.
export async function loadItemWear(db: Db, userId: string, itemId: string, now = new Date()): Promise<ItemWearLine | null> {
  const window = wearWindow(await latestLoggedDay(db, userId, addDays(chicagoDay(now), 1)));
  if (!window) return null;
  const { data } = await db
    .from("outfit_logs")
    .select("worn_on")
    .eq("user_id", userId)
    .contains("item_ids", [itemId])
    .gte("worn_on", window.from)
    .lte("worn_on", window.to)
    .order("worn_on", { ascending: false })
    .throwOnError();
  return { count: data.length, lastWorn: data[0]?.worn_on ?? null, window };
}
