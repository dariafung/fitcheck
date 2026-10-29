import { requireWriter } from "@/lib/auth/guard";
import { findItemSummary } from "@/lib/closet/items";
import { createVoiceUpload } from "@/lib/closet/voice/storage";
import { createServerClient } from "@/lib/db/server";

// Hands the browser a one-time URL to PUT its WAV to, for this user and item.
export async function POST(_req: Request, ctx: RouteContext<"/api/items/[id]/feelings/voice/upload">) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const { id } = await ctx.params;
  const db = createServerClient();
  const { userId } = writer;
  const item = await findItemSummary(db, userId, id);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(await createVoiceUpload(db, userId, item.id));
}
