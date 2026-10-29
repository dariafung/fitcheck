import { after } from "next/server";
import { parseFeeling } from "@/lib/ai";
import { requireWriter } from "@/lib/auth/guard";
import { FeelingBody } from "@/lib/closet/feeling-body";
import { saveFeeling, storeParsedFeeling } from "@/lib/closet/feelings";
import { findItemSummary } from "@/lib/closet/items";
import { createServerClient } from "@/lib/db/server";

// Saves the raw text right away; the structured fields are extracted after
// the response is sent. If that fails they stay empty until the next save.
export async function POST(req: Request, ctx: RouteContext<"/api/items/[id]/feelings">) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const { id } = await ctx.params;
  const body = FeelingBody.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Write something first." }, { status: 400 });
  }

  const db = createServerClient();
  const { userId } = writer;
  const item = await findItemSummary(db, userId, id);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });

  const { text, source } = body.data;
  const feeling = await saveFeeling(db, { itemId: item.id, userId, text, source });

  after(async () => {
    try {
      const structured = await parseFeeling({ text, item });
      await storeParsedFeeling(db, { feelingId: feeling.id, text, structured });
    } catch (err) {
      console.error(`parseFeeling failed for feeling ${feeling.id}:`, err);
    }
  });

  return Response.json({ feeling: { text } });
}
