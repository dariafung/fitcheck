import { aiErrorResponse, summarizeWear } from "@/lib/ai";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { outfitErrorResponse } from "@/lib/wear/http";
import { refreshInsights } from "@/lib/wear/insights";
import { loadWearLog } from "@/lib/wear/log";
import { wearLogEnabled } from "@/lib/wear/settings";

// Called by the calendar page when its insights are out of date; there is no
// button. Not limited to writers: like /api/pairings it only fills a cache,
// and the read-only demo log never changes, so it's asked once.
export async function POST() {
  const userId = await currentUserId();
  const db = createServerClient();
  if (!(await wearLogEnabled(db, userId))) return outfitErrorResponse("calendar_off");

  try {
    const result = await refreshInsights(db, userId, await loadWearLog(db, userId), (input) => summarizeWear(input));
    if (result.status === "not_enough") {
      return Response.json({ error: "NotEnoughDays", daysToGo: result.daysToGo }, { status: 400 });
    }
    return Response.json({ insights: result.insights });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
