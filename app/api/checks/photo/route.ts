import { z } from "zod";
import { requireWriter } from "@/lib/auth/guard";
import { decodeDataUrl } from "@/lib/check/board-pieces";
import { createServerClient } from "@/lib/db/server";
import { frameOriginal } from "@/lib/entry/frame";
import { storeImage } from "@/lib/entry/images";

// Vercel caps request bodies at 4.5 MB.
const MAX_PHOTO_LENGTH = 4_000_000;

const PhotoRequest = z.object({ photo: z.string().max(MAX_PHOTO_LENGTH) });

// POST { photo } → { path }: stores the photo of a checked item, framed like
// every item photo, so "I bought it" can save the item through POST
// /api/items like any other. Only that tap gets here: the check itself
// stores nothing. A photo the item is never saved with is removed by the
// daily cleanup of unsaved photos.
export async function POST(request: Request) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const body = PhotoRequest.safeParse(await request.json().catch(() => null));
  const photo = body.success ? decodeDataUrl(body.data.photo) : null;
  if (!photo) return Response.json({ error: "invalid_photo" }, { status: 400 });
  const framed = await frameOriginal(photo).catch(() => null);
  if (!framed) return Response.json({ error: "invalid_photo" }, { status: 400 });
  const path = await storeImage(createServerClient(), writer.userId, framed);
  return Response.json({ path }, { status: 201 });
}
