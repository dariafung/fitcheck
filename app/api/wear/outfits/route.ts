import { requireWriter } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/server";
import { outfitErrorResponse } from "@/lib/wear/http";
import { createOutfit, NewOutfit } from "@/lib/wear/outfits";
import { wearLogEnabled } from "@/lib/wear/settings";

// Logs one outfit for a day. Sending the same id again answers the outfit
// already logged; the same pieces again on one day answers 409.
export async function POST(req: Request) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const body = NewOutfit.safeParse(await req.json().catch(() => null));
  if (!body.success) return outfitErrorResponse("bad_request");
  const db = createServerClient();
  if (!(await wearLogEnabled(db, writer.userId))) return outfitErrorResponse("calendar_off");

  const result = await createOutfit(db, writer.userId, body.data);
  if (!result.ok) return outfitErrorResponse(result.error);
  return Response.json({ outfit: result.outfit }, { status: 201 });
}
