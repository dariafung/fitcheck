import { judgePairing, judgeRepeat, scorePurchase } from "@/lib/ai";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { findBuyers } from "@/lib/resale/buyers";

// Up to five buy checks run at once, each up to ~25 s.
export const maxDuration = 300;

// Matching buyers for one of the user's passing-on items: how many buyers would likely
// want it, or why there are none. A POST because finding them runs buy checks
// for buyers not checked yet. The demo account may call it too.
export async function POST(_req: Request, ctx: RouteContext<"/api/items/[id]/buyers">) {
  const { id } = await ctx.params;
  const result = await findBuyers(createServerClient(), await currentUserId(), id, {
    judge: judgePairing,
    score: scorePurchase,
    repeat: judgeRepeat,
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  if (result === "not_passing_on") return Response.json({ error: "not_passing_on" }, { status: 409 });
  return Response.json(result);
}
