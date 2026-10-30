import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { findBuyers } from "@/lib/resale/buyers";

// Who'd want one of the user's passing-on items: anonymous buyers and their
// scores, or why there are none. A POST because finding them will run buy
// checks for buyers not checked yet. The demo account may call it too.
export async function POST(_req: Request, ctx: RouteContext<"/api/items/[id]/buyers">) {
  const { id } = await ctx.params;
  const result = await findBuyers(createServerClient(), await currentUserId(), id);
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  if (result === "not_passing_on") return Response.json({ error: "not_passing_on" }, { status: 409 });
  return Response.json(result);
}
