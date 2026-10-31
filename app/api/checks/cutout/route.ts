import { z } from "zod";
import { ItemTags } from "@/lib/ai/schemas/common";
import { decodeDataUrl } from "@/lib/check/board-pieces";
import { cleanUpPhotoWithinLimit } from "@/lib/entry/cleanup";

// A live Muse Image call can take a while; see lib/ai/live/segment-garment.ts.
export const maxDuration = 300;

// Vercel caps request bodies at 4.5 MB.
const MAX_PHOTO_LENGTH = 4_000_000;

const CutoutRequest = z.object({
  photo: z.string().max(MAX_PHOTO_LENGTH),
  title: z.string().trim().min(1).max(200),
  tags: ItemTags,
});

// POST { photo, title, tags } → { photo } of the garment alone on white, or
// { error: "not_cleaned" } when the model couldn't do it; the page then
// keeps the original. Like the rest of the check, nothing is stored, so the
// read-only demo account can use it too.
export async function POST(request: Request) {
  const body = CutoutRequest.safeParse(await request.json().catch(() => null));
  const photo = body.success ? decodeDataUrl(body.data.photo) : null;
  if (!body.success || !photo) return Response.json({ error: "invalid_photo" }, { status: 400 });

  const cleaned = await cleanUpPhotoWithinLimit(photo, body.data);
  if (!cleaned) return Response.json({ error: "not_cleaned" });
  return Response.json({ photo: `data:image/webp;base64,${cleaned.toString("base64")}` });
}
