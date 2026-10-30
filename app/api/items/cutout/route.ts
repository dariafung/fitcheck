import { z } from "zod";
import { ItemTags } from "@/lib/ai/schemas/common";
import { requireWriter } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/server";
import { cleanUpPhoto } from "@/lib/entry/cleanup";
import { isOwnImagePath, ITEM_IMAGES_BUCKET, signImages, storeImage } from "@/lib/entry/images";

// A live Muse Image call can take a while; see lib/ai/live/segment-garment.ts.
export const maxDuration = 300;

const CutoutRequest = z.object({
  path: z.string(),
  title: z.string().trim().min(1).max(200),
  tags: ItemTags,
});

// POST { path, title, tags } → { path, url } of the garment alone on white,
// or { error: "not_cleaned" } when the model couldn't do it; the page then
// keeps the original. For an on-model photo the extract step just stored.
// The new photo is stored next to it; whichever one the item isn't saved
// with is removed by the daily cleanup of unsaved photos.
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

  const cleaned = await cleanUpPhoto(Buffer.from(await data.arrayBuffer()), body.data);
  if (!cleaned) return Response.json({ error: "not_cleaned" });
  const path = await storeImage(db, writer.userId, cleaned);
  const [url] = await signImages(db, [path]);
  return Response.json({ path, url });
}
