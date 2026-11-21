import sharp from "sharp";
import { z } from "zod";
import { requireWriter } from "@/lib/auth/guard";
import { decodeDataUrl } from "@/lib/check/board-pieces";
import { createServerClient } from "@/lib/db/server";
import { storeImage, toItemWebp } from "@/lib/entry/images";

// Vercel caps request bodies at 4.5 MB.
const MAX_PHOTO_LENGTH = 4_000_000;

const PhotoRequest = z.object({ photo: z.string().max(MAX_PHOTO_LENGTH) });

// POST { photo } → { path }: stores the photo of a checked item, so "I
// bought it" can save the item through POST /api/items like any other. Only
// that tap gets here: the check itself stores nothing. The photo comes
// framed already (/api/checks/extract, or the cut-out), so it is stored as
// it is, as our usual WebP. A photo the item is never saved with is removed
// by the daily cleanup of unsaved photos.
export async function POST(request: Request) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const body = PhotoRequest.safeParse(await request.json().catch(() => null));
  const photo = body.success ? decodeDataUrl(body.data.photo) : null;
  if (!photo) return Response.json({ error: "invalid_photo" }, { status: 400 });
  const webp = await toItemWebp(sharp(photo)).catch(() => null);
  if (!webp) return Response.json({ error: "invalid_photo" }, { status: 400 });
  const path = await storeImage(createServerClient(), writer.userId, webp);
  return Response.json({ path }, { status: 201 });
}
