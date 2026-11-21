import { z } from "zod";
import { requireWriter } from "@/lib/auth/guard";
import { unsaveOutfit } from "@/lib/closet/saved-outfits";
import { createServerClient } from "@/lib/db/server";

const OutfitId = z.uuid();

// Removes one of the user's saved outfits.
export async function DELETE(_req: Request, ctx: RouteContext<"/api/saved-outfits/[id]">) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const { id } = await ctx.params;
  const found = OutfitId.safeParse(id).success && (await unsaveOutfit(createServerClient(), writer.userId, id));
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
