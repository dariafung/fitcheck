import { aiErrorResponse, judgePairing } from "@/lib/ai";
import { computeClosetOutfits } from "@/lib/check/pairings";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { withDaily } from "@/lib/limits/daily";

// Every complete outfit in the current user's closet. Pairs not yet judged
// are sent to judgePairing and cached, so repeat calls cost nothing. The
// request body is ignored: the user always comes from the server.
export async function POST() {
  const userId = await currentUserId();
  const db = createServerClient();
  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle()
    .throwOnError();
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  try {
    // All from the cache: the model wasn't asked, so it doesn't count.
    const outfits = await withDaily("pairings", () => computeClosetOutfits(db, userId, judgePairing), {
      result: (r) => r.stats.judgeCalls === 0,
    });
    return Response.json(outfits);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
