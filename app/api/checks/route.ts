import { z } from "zod";
import { aiErrorResponse, judgePairing, judgeRepeat, scorePurchase } from "@/lib/ai";
import { ItemTags } from "@/lib/ai/schemas/common";
import { isIncomplete, runBuyCheck } from "@/lib/check/buy-check";
import { INCOMPLETE_ERROR, INCOMPLETE_NOTICE } from "@/lib/check/reasons";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";

const CheckRequest = z.object({
  title: z.string().trim().min(1).max(200),
  tags: ItemTags,
});

// POST { title, tags } → { result }, { unsupported, message } or, when the
// model never finished scoring, { error: "incomplete", message }. Checks one
// item against the current user's closet. Nothing about the item is stored
// or cached, so every call asks the model again; the score itself is
// computed in code. Other body fields (price included) are ignored.
export async function POST(request: Request) {
  const parsed = CheckRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid item", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const check = await runBuyCheck(createServerClient(), await currentUserId(), parsed.data, {
      judge: judgePairing,
      score: scorePurchase,
      repeat: judgeRepeat,
    });
    if (!check) return Response.json({ error: "User not found" }, { status: 404 });
    return Response.json(check);
  } catch (err) {
    if (isIncomplete(err)) return Response.json({ error: INCOMPLETE_ERROR, message: INCOMPLETE_NOTICE });
    return aiErrorResponse(err);
  }
}
