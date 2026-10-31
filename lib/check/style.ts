// "Style it with AI": one sample outfit drawn by Muse Image as a whole
// flat-lay board. The candidate's photo comes from the page and the owned
// items' photos from storage; nothing is stored and nothing is cached.
import sharp from "sharp";
import { describeItem } from "../ai/live/describe";
import type { Category, ItemTags } from "../ai/schemas/common";
import type { RenderOutfitInput } from "../ai/schemas/render-outfit";
import type { Db } from "../db/server";
import { effectiveTags } from "../db/items";
import { readPhoto } from "./board-pieces";
import { CANDIDATE_ITEM_ID } from "./pairings";
import { toClosetItem } from "./types";

// Longest side of each reference photo sent to the model.
export const REFERENCE_MAX_SIDE = 1024;

// Pieces are described to the model top to toe, the layer and shoes last.
const ORDER: Category[] = ["top", "bottom", "one_piece", "outerwear", "shoes", "accessory"];

export interface StylePiece {
  id: string;
  title: string;
  category: Category;
  // Null when the tags can't be read; the title alone describes it then.
  tags: ItemTags | null;
  photo: Buffer;
}

export function sortPieces<T extends { category: Category }>(pieces: readonly T[]): T[] {
  return [...pieces].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
}

async function referencePng(photo: Buffer): Promise<string> {
  const png = await sharp(photo)
    .rotate()
    .resize(REFERENCE_MAX_SIDE, REFERENCE_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  return png.toString("base64");
}

// The renderOutfit input for one outfit, pieces in drawing order.
export async function styleInput(pieces: readonly StylePiece[]): Promise<RenderOutfitInput> {
  return {
    items: await Promise.all(
      sortPieces(pieces).map(async (piece) => ({
        id: piece.id,
        image: { kind: "inline" as const, mime: "image/png", base64: await referencePng(piece.photo) },
        category: piece.category,
        description: piece.tags ? describeItem(piece.title, piece.tags) : piece.title,
      })),
    ),
  };
}

export function candidatePiece(title: string, tags: ItemTags, photo: Buffer): StylePiece {
  return { id: CANDIDATE_ITEM_ID, title, category: tags.category, tags, photo };
}

export type OwnedStylePieces =
  // Not all of them are the user's active items.
  | { kind: "not_owned" }
  // One has no photo, or its photo couldn't be read.
  | { kind: "no_photo" }
  | { kind: "ok"; pieces: StylePiece[] };

export async function ownedStylePieces(db: Db, userId: string, ids: readonly string[]): Promise<OwnedStylePieces> {
  const { data } = await db
    .from("items")
    .select("id, title, category, ai_tags, user_tags, image_paths")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("id", [...ids])
    .throwOnError();
  if (data.length !== new Set(ids).size) return { kind: "not_owned" };
  const pieces = await Promise.all(
    data.map(async (row) => {
      const [path] = row.image_paths;
      const photo = path ? await readPhoto(db, path) : null;
      if (!photo) return null;
      const item = toClosetItem(row.id, row.title, effectiveTags(row.ai_tags as ItemTags, row.user_tags as Partial<ItemTags> | null));
      return { id: row.id, title: row.title, category: row.category as Category, tags: item?.tags ?? null, photo };
    }),
  );
  return pieces.every((p) => p !== null) ? { kind: "ok", pieces } : { kind: "no_photo" };
}
