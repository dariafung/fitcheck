import { randomUUID } from "node:crypto";
import type { Sharp } from "sharp";
import type { Db } from "@/lib/db/server";

export const ITEM_IMAGES_BUCKET = "item-images";
const MAX_SIDE = 1600;
const SIGNED_URL_SECONDS = 60 * 60;

// <userId>/<uuid>.webp — the only shape POST /api/items accepts.
const PATH = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.webp$/;

export function isOwnImagePath(path: string, userId: string): boolean {
  return PATH.exec(path)?.[1] === userId;
}

// Our stored copy of an item photo: WebP, longest side at most 1600 px.
export function toItemWebp(image: Sharp): Promise<Buffer> {
  return image
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

export async function storeImage(db: Db, userId: string, webp: Buffer): Promise<string> {
  const path = `${userId}/${randomUUID()}.webp`;
  const { error } = await db.storage
    .from(ITEM_IMAGES_BUCKET)
    .upload(path, webp, { contentType: "image/webp" });
  if (error) throw error;
  return path;
}

// Short-lived URLs for showing private images in the browser.
export async function signImages(db: Db, paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await db.storage
    .from(ITEM_IMAGES_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw error;
  return data.flatMap((d) => (d.signedUrl ? [d.signedUrl] : []));
}
