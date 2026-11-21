// The pieces of an owned outfit as an outfit board draws them: each active
// item's first photo, cut out of its plain background in code (no model
// call), or the photo as it is when that can't be done.
import { Category } from "@/lib/ai/schemas/common";
import { cutOut } from "@/lib/check/board";
import { readPhoto } from "@/lib/check/board-pieces";
import type { Db } from "@/lib/db/server";
import { imageUrls } from "./images";

export interface OutfitPiece {
  id: string;
  title: string;
  category: Category;
  // A cut-out as a data URL, else the photo's URL, else null.
  src: string | null;
  cutout: boolean;
}

export interface OutfitView {
  // Sorted and unique, as stored.
  itemIds: string[];
  // In board order.
  pieces: OutfitPiece[];
}

const SLOT_ORDER: readonly string[] = ["top", "one_piece", "bottom", "shoes", "outerwear"];

async function cutOutUrl(db: Db, path: string | undefined, onModel: boolean | null): Promise<string | null> {
  if (!path || onModel) return null;
  const photo = await readPhoto(db, path);
  const webp = photo && (await cutOut(photo).catch(() => null));
  return webp ? `data:image/webp;base64,${webp.toString("base64")}` : null;
}

// The user's active items among `ids`, by id; anything else is left out.
export async function outfitPieces(db: Db, userId: string, ids: readonly string[]): Promise<Map<string, OutfitPiece>> {
  if (ids.length === 0) return new Map();
  const { data } = await db
    .from("items")
    .select("id, title, category, image_paths, on_model")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("id", [...new Set(ids)])
    .throwOnError();
  const pieces = await Promise.all(
    data.map(async (row): Promise<OutfitPiece> => {
      const [path] = row.image_paths;
      const cut = await cutOutUrl(db, path, row.on_model);
      const [plain] = cut || !path ? [] : await imageUrls(db, [path]).catch(() => []);
      const category = Category.safeParse(row.category);
      return {
        id: row.id,
        title: row.title,
        category: category.success ? category.data : "accessory",
        src: cut ?? plain ?? null,
        cutout: cut !== null,
      };
    }),
  );
  return new Map(pieces.map((p) => [p.id, p]));
}

// One outfit ready to draw, or null when a piece is missing from `pieces`
// (deleted, or no longer active).
export function outfitView(itemIds: readonly string[], pieces: ReadonlyMap<string, OutfitPiece>): OutfitView | null {
  const found = itemIds.flatMap((id) => pieces.get(id) ?? []);
  if (found.length !== itemIds.length) return null;
  const slot = (p: OutfitPiece) => SLOT_ORDER.indexOf(p.category);
  return {
    itemIds: [...itemIds].sort(),
    pieces: found.sort((a, b) => slot(a) - slot(b) || (a.id < b.id ? -1 : 1)),
  };
}
