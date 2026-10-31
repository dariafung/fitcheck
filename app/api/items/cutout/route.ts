import { z } from "zod";
import { ItemTags } from "@/lib/ai/schemas/common";
import { requireWriter } from "@/lib/auth/guard";
import { createServerClient, type Db } from "@/lib/db/server";
import { cleanUpPhotoWithinLimit } from "@/lib/entry/cleanup";
import { frameOriginal } from "@/lib/entry/frame";
import { isOwnImagePath, ITEM_IMAGES_BUCKET, signImages, storeImage } from "@/lib/entry/images";

// A live Muse Image call can take a while; see lib/ai/live/segment-garment.ts.
export const maxDuration = 300;

const CutoutRequest = z.object({
  path: z.string(),
  title: z.string().trim().min(1).max(200),
  tags: ItemTags,
});

// POST { path, title, tags } → { path, url, original } of the garment alone
// on white, or { error: "not_cleaned", original } when the model couldn't do
// it. `original` ({ path, url }) is the store's photo framed the same way, for
// the page to fall back on or for "Use original photo". For the photo the
// extract step just stored; the new ones are stored next to it, and whichever
// the item isn't saved with is removed by the daily cleanup of unsaved photos.
export async function POST(request: Request) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const body = CutoutRequest.safeParse(await request.json().catch(() => null));
  if (!body.success || !isOwnImagePath(body.data.path, writer.userId)) {
    return Response.json({ error: "invalid_photo" }, { status: 400 });
  }
  const db = createServerClient();
  const { data, error } = await db.storage.from(ITEM_IMAGES_BUCKET).download(body.data.path);
  if (error) return Response.json({ error: "invalid_photo" }, { status: 404 });

  const photo = Buffer.from(await data.arrayBuffer());
  const [cleaned, framed] = await Promise.all([cleanUpPhotoWithinLimit(photo, body.data), frameOriginal(photo)]);
  const original = await stored(db, writer.userId, framed);
  if (!cleaned) return Response.json({ error: "not_cleaned", original });
  return Response.json({ ...(await stored(db, writer.userId, cleaned)), original });
}

async function stored(db: Db, userId: string, webp: Buffer) {
  const path = await storeImage(db, userId, webp);
  const [url] = await signImages(db, [path]);
  return { path, url };
}
