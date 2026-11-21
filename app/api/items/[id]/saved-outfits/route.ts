import { connection } from "next/server";
import { requireWriter } from "@/lib/auth/guard";
import { findItemSummary } from "@/lib/closet/items";
import { listSavedOutfitsFor } from "@/lib/closet/saved-outfits";
import { createServerClient } from "@/lib/db/server";

// The saved outfits that contain one of the user's items, newest first, with
// the pieces to draw. The demo account can't save, so it has none to list.
export async function GET(_req: Request, ctx: RouteContext<"/api/items/[id]/saved-outfits">) {
  await connection();
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const { id } = await ctx.params;
  const db = createServerClient();
  const item = await findItemSummary(db, writer.userId, id);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ outfits: await listSavedOutfitsFor(db, writer.userId, item.id) });
}
