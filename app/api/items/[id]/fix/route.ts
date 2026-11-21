import { pickFixOutfit } from "@/lib/ai";
import { fixOutfitFor, fixView } from "@/lib/closet/fix-outfit-store";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { withDaily } from "@/lib/limits/daily";

// One model call, up to 60 s, plus cutting out the photos.
export const maxDuration = 120;

// The outfit for one of the user's items they are unhappy with (rated 1 or
// 2 stars, or with a complaint in its feeling), asked for by the item page
// when it opens. A POST because it asks the model
// when nothing is stored for the item as it is now; a daily count is taken
// only then. Answers a state: "suggestion" (the outfit, one reason, whether
// it's saved), "no_fix", "pending" while the feeling is being parsed, or
// "none". With ?settle=1, the page's last try, a piece rated low whose
// feeling still isn't parsed is suggested for from the rating alone. Never
// an AI error: when the model can't be asked the stored
// suggestion is answered, or "none". The demo account may call it; its
// suggestions come from the seed.
export async function POST(req: Request, ctx: RouteContext<"/api/items/[id]/fix">) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  const db = createServerClient();
  const settle = new URL(req.url).searchParams.get("settle") === "1";
  const fix = await fixOutfitFor(db, userId, id, (input) => withDaily("fix", () => pickFixOutfit(input)), { settle });
  if (!fix) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await fixView(db, userId, fix));
}
