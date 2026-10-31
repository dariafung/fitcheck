// Photos for scorePurchase: the candidate's from the page and the closest
// felt items' from storage, shrunk so a check costs little more. Nothing is
// stored; a photo that can't be read is left out and the item goes as text.
import sharp from "sharp";
import type { MediaRef } from "../ai/schemas/common";
import type { Db } from "../db/server";
import { readPhoto } from "./board-pieces";

// Longest side of each photo sent to the model.
export const SCORE_PHOTO_MAX_SIDE = 512;

export async function scoringPhoto(photo: Buffer): Promise<MediaRef | null> {
  try {
    const webp = await sharp(photo)
      .rotate()
      .resize(SCORE_PHOTO_MAX_SIDE, SCORE_PHOTO_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .webp({ quality: 80 })
      .toBuffer();
    return { kind: "inline", mime: "image/webp", base64: webp.toString("base64") };
  } catch {
    return null;
  }
}

// Each item's first photo, by id; items without one are missing.
export async function itemPhotos(db: Db, userId: string, ids: readonly string[]): Promise<Map<string, MediaRef>> {
  const photos = new Map<string, MediaRef>();
  if (ids.length === 0) return photos;
  const { data } = await db
    .from("items")
    .select("id, image_paths")
    .eq("user_id", userId)
    .in("id", [...ids])
    .throwOnError();
  await Promise.all(
    data.map(async (row) => {
      const [path] = row.image_paths;
      const photo = path ? await readPhoto(db, path) : null;
      const ref = photo && (await scoringPhoto(photo));
      if (ref) photos.set(row.id, ref);
    }),
  );
  return photos;
}
