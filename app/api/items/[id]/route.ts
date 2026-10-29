import { connection } from "next/server";
import { requireWriter } from "@/lib/auth/guard";
import { ItemPatch } from "@/lib/closet/item-patch";
import { deleteClosetItem, getClosetItem, updateItemTempRange } from "@/lib/closet/items";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";

export async function GET(_req: Request, ctx: RouteContext<"/api/items/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const item = await getClosetItem(createServerClient(), await currentUserId(), id);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ item });
}

// Only the comfortable temperature range can be edited so far. Returns the
// item's range with the edit applied.
export async function PATCH(req: Request, ctx: RouteContext<"/api/items/[id]">) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const { id } = await ctx.params;
  const body = ItemPatch.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Send a temperature range, low to high, in °F." }, { status: 400 });
  }
  const range = await updateItemTempRange(createServerClient(), writer.userId, id, body.data.tempRangeF);
  if (!range) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ tempRangeF: range });
}

// Deletes the item with its feeling, its pairings and its photos.
export async function DELETE(_req: Request, ctx: RouteContext<"/api/items/[id]">) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const { id } = await ctx.params;
  const deleted = await deleteClosetItem(createServerClient(), writer.userId, id);
  if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
