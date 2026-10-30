import { connection } from "next/server";
import { requireWriter } from "@/lib/auth/guard";
import { ItemPatch } from "@/lib/closet/item-patch";
import { deleteClosetItem, getClosetItem, updateClosetItem } from "@/lib/closet/items";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";

export async function GET(_req: Request, ctx: RouteContext<"/api/items/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const item = await getClosetItem(createServerClient(), await currentUserId(), id);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ item });
}

// Edits the item's details (name, brand, tags), its status (active or
// passing_on) and/or its size. Returns the item as GET does, with the edit
// applied. An item can't be passing on without a size.
export async function PATCH(req: Request, ctx: RouteContext<"/api/items/[id]">) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const { id } = await ctx.params;
  const body = ItemPatch.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "invalid_item", issues: body.error.issues }, { status: 400 });
  }
  const db = createServerClient();
  const result = await updateClosetItem(db, writer.userId, id, body.data);
  if (result === "not_found") return Response.json({ error: "Not found" }, { status: 404 });
  if (result === "size_required") return Response.json({ error: "size_required" }, { status: 400 });
  return Response.json({ item: await getClosetItem(db, writer.userId, id) });
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
