import { z } from "zod";
import { requireWriter } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/server";
import { outfitErrorResponse } from "@/lib/wear/http";
import { deleteOutfit, OutfitPatch, updateOutfit } from "@/lib/wear/outfits";
import { wearLogEnabled } from "@/lib/wear/settings";

const OutfitId = z.uuid();

// Changes an outfit's pieces or occasion, within the last 30 days.
export async function PATCH(req: Request, ctx: RouteContext<"/api/wear/outfits/[id]">) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const { id } = await ctx.params;
  const body = OutfitPatch.safeParse(await req.json().catch(() => null));
  if (!OutfitId.safeParse(id).success) return outfitErrorResponse("not_found");
  if (!body.success) return outfitErrorResponse("bad_request");
  const db = createServerClient();
  if (!(await wearLogEnabled(db, writer.userId))) return outfitErrorResponse("calendar_off");

  const result = await updateOutfit(db, writer.userId, id, body.data);
  if (!result.ok) return outfitErrorResponse(result.error);
  return Response.json({ outfit: result.outfit });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/wear/outfits/[id]">) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const { id } = await ctx.params;
  if (!OutfitId.safeParse(id).success) return outfitErrorResponse("not_found");
  const db = createServerClient();
  if (!(await wearLogEnabled(db, writer.userId))) return outfitErrorResponse("calendar_off");

  const result = await deleteOutfit(db, writer.userId, id);
  if (!result.ok) return outfitErrorResponse(result.error);
  return new Response(null, { status: 204 });
}
