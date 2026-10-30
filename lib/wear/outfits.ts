// Reads and writes outfit_logs: one row per outfit, several a day allowed.
// Item ids are stored sorted, so the database can refuse the same outfit
// twice on one day (outfit_logs_unique_outfit).
import { z } from "zod";
import { Occasion } from "@/lib/ai/schemas/common";
import type { Db } from "@/lib/db/server";
import { IsoDate, MAX_OUTFITS_PER_DAY, serverAllowsDay } from "./day";
import type { LoggedOutfit } from "./stats";

// Generous: one outfit is a handful of pieces.
const MAX_PIECES = 12;

const ItemIds = z.array(z.uuid()).min(1).max(MAX_PIECES);

// POST /api/wear/outfits. The browser picks the id, so sending the same
// outfit twice (a double tap, a retry) still logs it once.
export const NewOutfit = z.strictObject({
  id: z.uuid(),
  date: IsoDate,
  itemIds: ItemIds,
  occasion: Occasion.nullable(),
});
export type NewOutfit = z.infer<typeof NewOutfit>;

// PATCH /api/wear/outfits/[id].
export const OutfitPatch = z
  .strictObject({ itemIds: ItemIds, occasion: Occasion.nullable() })
  .partial()
  .refine((p) => p.itemIds !== undefined || p.occasion !== undefined, { message: "Nothing to change" });
export type OutfitPatch = z.infer<typeof OutfitPatch>;

export type OutfitWrite =
  | { ok: true; outfit: LoggedOutfit }
  | { ok: false; error: "not_found" | "too_old" | "unknown_items" | "duplicate" | "day_full" };

const COLUMNS = "id, worn_on, item_ids, occasion";

interface Row {
  id: string;
  worn_on: string;
  item_ids: string[];
  occasion: string | null;
}

function toOutfit(row: Row): LoggedOutfit {
  const occasion = Occasion.safeParse(row.occasion);
  return { id: row.id, date: row.worn_on, itemIds: row.item_ids, occasion: occasion.success ? occasion.data : null };
}

const sorted = (ids: readonly string[]) => [...new Set(ids)].sort();

// Outfits from `from` to `to`, oldest first; a day's in the order logged.
export async function listOutfits(db: Db, userId: string, from: string, to: string): Promise<LoggedOutfit[]> {
  const { data } = await db
    .from("outfit_logs")
    .select(COLUMNS)
    .eq("user_id", userId)
    .gte("worn_on", from)
    .lte("worn_on", to)
    .order("worn_on")
    .order("created_at")
    .throwOnError();
  return data.map(toOutfit);
}

// The last day with a log, up to `until`; null with none.
export async function latestLoggedDay(db: Db, userId: string, until: string): Promise<string | null> {
  const { data } = await db
    .from("outfit_logs")
    .select("worn_on")
    .eq("user_id", userId)
    .lte("worn_on", until)
    .order("worn_on", { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError();
  return data?.worn_on ?? null;
}

async function ownsItems(db: Db, userId: string, ids: readonly string[]): Promise<boolean> {
  const { count } = await db
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("id", [...ids])
    .throwOnError();
  return count === ids.length;
}

async function outfitsOn(db: Db, userId: string, date: string): Promise<number> {
  const { count } = await db
    .from("outfit_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("worn_on", date)
    .throwOnError();
  return count ?? 0;
}

async function findOutfit(db: Db, userId: string, id: string): Promise<LoggedOutfit | null> {
  const { data } = await db.from("outfit_logs").select(COLUMNS).eq("id", id).eq("user_id", userId).maybeSingle().throwOnError();
  return data && toOutfit(data);
}

const UNIQUE_VIOLATION = "23505";

export async function createOutfit(db: Db, userId: string, input: NewOutfit): Promise<OutfitWrite> {
  const itemIds = sorted(input.itemIds);
  // Already logged under this id: the same request again, so the same answer.
  const existing = await findOutfit(db, userId, input.id);
  if (existing) return { ok: true, outfit: existing };
  if (!serverAllowsDay(input.date)) return { ok: false, error: "too_old" };
  if (!(await ownsItems(db, userId, itemIds))) return { ok: false, error: "unknown_items" };
  if ((await outfitsOn(db, userId, input.date)) >= MAX_OUTFITS_PER_DAY) return { ok: false, error: "day_full" };

  const { data, error } = await db
    .from("outfit_logs")
    .insert({ id: input.id, user_id: userId, worn_on: input.date, item_ids: itemIds, occasion: input.occasion })
    .select(COLUMNS)
    .single();
  if (error?.code === UNIQUE_VIOLATION) {
    // A retry that raced the first insert, or the same pieces already that day.
    const raced = await findOutfit(db, userId, input.id);
    return raced ? { ok: true, outfit: raced } : { ok: false, error: "duplicate" };
  }
  if (error) throw error;
  return { ok: true, outfit: toOutfit(data) };
}

export async function updateOutfit(db: Db, userId: string, id: string, patch: OutfitPatch): Promise<OutfitWrite> {
  const existing = await findOutfit(db, userId, id);
  if (!existing) return { ok: false, error: "not_found" };
  if (!serverAllowsDay(existing.date)) return { ok: false, error: "too_old" };
  const itemIds = patch.itemIds && sorted(patch.itemIds);
  if (itemIds && !(await ownsItems(db, userId, itemIds))) return { ok: false, error: "unknown_items" };

  const { data, error } = await db
    .from("outfit_logs")
    .update({ ...(itemIds && { item_ids: itemIds }), ...(patch.occasion !== undefined && { occasion: patch.occasion }) })
    .eq("id", id)
    .eq("user_id", userId)
    .select(COLUMNS)
    .single();
  if (error?.code === UNIQUE_VIOLATION) return { ok: false, error: "duplicate" };
  if (error) throw error;
  return { ok: true, outfit: toOutfit(data) };
}

export async function deleteOutfit(
  db: Db,
  userId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: "not_found" | "too_old" }> {
  const existing = await findOutfit(db, userId, id);
  if (!existing) return { ok: false, error: "not_found" };
  if (!serverAllowsDay(existing.date)) return { ok: false, error: "too_old" };
  await db.from("outfit_logs").delete().eq("id", id).eq("user_id", userId).throwOnError();
  return { ok: true };
}
