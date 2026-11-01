import type { Db } from "@/lib/db/server";
import { imageUrls } from "./images";
import { isItemId } from "./items";
import { swatchHex } from "./swatch";

export interface PairedPiece {
  id: string;
  title: string;
  category: string;
  imageUrl: string | null;
  swatch: string;
}

export interface GoesWith {
  // Every piece it goes with; only the first `shown` come with a photo.
  count: number;
  pieces: PairedPiece[];
}

// What one item goes with, read from the verdicts the pairing engine has
// already cached (lib/check/pairings.ts): rows that say the two pair, where
// the other piece is still being worn. Read only. It never asks the model, so
// a pair nobody has judged yet is simply not listed.
export async function goesWith(db: Db, userId: string, itemId: string, shown = 4): Promise<GoesWith> {
  if (!isItemId(itemId)) return { count: 0, pieces: [] };
  const { data: rows } = await db
    .from("pairings")
    .select("item_a_id, item_b_id")
    .eq("user_id", userId)
    .eq("pairs", true)
    .or(`item_a_id.eq.${itemId},item_b_id.eq.${itemId}`)
    .throwOnError();
  const others = [...new Set(rows.map((r) => (r.item_a_id === itemId ? r.item_b_id : r.item_a_id)))];
  if (others.length === 0) return { count: 0, pieces: [] };

  // In the closet's order, newest first.
  const { data: items } = await db
    .from("items")
    .select("id, title, category, image_paths, ai_tags, user_tags")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("id", others)
    .order("created_at", { ascending: false })
    .order("title")
    .throwOnError();

  const first = items.slice(0, shown);
  const covers = await imageUrls(
    db,
    first.flatMap((row) => row.image_paths.slice(0, 1)),
  );
  let next = 0;
  return {
    count: items.length,
    pieces: first.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      imageUrl: row.image_paths.length > 0 ? (covers[next++] ?? null) : null,
      swatch: swatchHex(row),
    })),
  };
}
