// Saved outfits: one row per outfit, its item ids stored sorted and unique so
// the database can refuse the same outfit twice (saved_outfits_unique_outfit).
// An outfit isn't tied to the item page it was saved from: it shows on the
// page of every piece in it.
import { z } from "zod";
import type { Db } from "@/lib/db/server";
import { outfitKey } from "./fix-outfit";
import { outfitPieces, outfitView, type OutfitView } from "./outfit-pieces";

// Top, bottom, shoes and a layer, with room to spare.
export const MAX_SAVED_PIECES = 6;

// POST /api/saved-outfits.
export const SaveOutfitBody = z.strictObject({
  itemIds: z.array(z.uuid()).min(2).max(MAX_SAVED_PIECES),
});

export interface SavedOutfit {
  id: string;
  itemIds: string[];
}

export interface SavedOutfitView extends OutfitView {
  id: string;
}

const UNIQUE_VIOLATION = "23505";

async function ownsActive(db: Db, userId: string, ids: readonly string[]): Promise<boolean> {
  const { count } = await db
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
    .in("id", [...ids])
    .throwOnError();
  return count === ids.length;
}

// The saved outfit made of exactly these pieces, if there is one.
export async function findSavedOutfit(db: Db, userId: string, itemIds: readonly string[]): Promise<SavedOutfit | null> {
  const ids = outfitKey(itemIds);
  const { data } = await db
    .from("saved_outfits")
    .select("id, item_ids")
    .eq("user_id", userId)
    .contains("item_ids", ids)
    .throwOnError();
  const row = data.find((r) => r.item_ids.length === ids.length);
  return row ? { id: row.id, itemIds: row.item_ids } : null;
}

export type SaveResult =
  | { ok: true; outfit: SavedOutfit; created: boolean }
  | { ok: false; error: "unknown_items" };

// Saves an outfit of the user's own active pieces. Saving the same pieces
// again answers the outfit already saved.
export async function saveOutfit(db: Db, userId: string, itemIds: readonly string[]): Promise<SaveResult> {
  const ids = outfitKey(itemIds);
  if (ids.length < 2 || !(await ownsActive(db, userId, ids))) return { ok: false, error: "unknown_items" };
  const { data, error } = await db
    .from("saved_outfits")
    .insert({ user_id: userId, item_ids: ids })
    .select("id, item_ids")
    .single();
  if (error?.code === UNIQUE_VIOLATION) {
    const existing = await findSavedOutfit(db, userId, ids);
    if (existing) return { ok: true, outfit: existing, created: false };
  }
  if (error) throw error;
  return { ok: true, outfit: { id: data.id, itemIds: data.item_ids }, created: true };
}

// False when it is not this user's.
export async function unsaveOutfit(db: Db, userId: string, id: string): Promise<boolean> {
  const { data } = await db
    .from("saved_outfits")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle()
    .throwOnError();
  return data !== null;
}

// The user's saved outfits that contain this item, newest first, ready to
// draw. An outfit with a piece that was deleted or is being passed on is
// left out (the row stays).
export async function listSavedOutfitsFor(db: Db, userId: string, itemId: string): Promise<SavedOutfitView[]> {
  const { data } = await db
    .from("saved_outfits")
    .select("id, item_ids")
    .eq("user_id", userId)
    .contains("item_ids", [itemId])
    .order("created_at", { ascending: false })
    .throwOnError();
  const pieces = await outfitPieces(
    db,
    userId,
    data.flatMap((row) => row.item_ids),
  );
  return data.flatMap((row) => {
    const view = outfitView(row.item_ids, pieces);
    return view ? [{ id: row.id, ...view }] : [];
  });
}
