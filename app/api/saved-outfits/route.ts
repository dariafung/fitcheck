import { requireWriter } from "@/lib/auth/guard";
import { SaveOutfitBody, saveOutfit } from "@/lib/closet/saved-outfits";
import { createServerClient } from "@/lib/db/server";

// Saves an outfit: two or more of the user's own active items. Saving the
// same pieces again answers the outfit already saved (200 instead of 201).
export async function POST(req: Request) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const body = SaveOutfitBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const result = await saveOutfit(createServerClient(), writer.userId, body.data.itemIds);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ outfit: result.outfit }, { status: result.created ? 201 : 200 });
}
