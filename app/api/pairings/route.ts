import { aiErrorResponse, judgePairing } from "@/lib/ai";
import { computeClosetOutfits } from "@/lib/check/pairings";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";

// Every complete outfit in the current user's closet. Pairs not yet judged
// are sent to judgePairing and cached, so repeat calls cost nothing. The
// request body is ignored: the user always comes from the server.
export async function POST() {
  const userId = currentUserId();
  const db = createServerClient();
  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle()
    .throwOnError();
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  try {
    return Response.json(await computeClosetOutfits(db, userId, judgePairing));
  } catch (err) {
    return aiErrorResponse(err);
  }
}
