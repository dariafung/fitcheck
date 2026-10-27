import { z } from "zod";
import { aiErrorResponse, judgePairing, scorePurchase } from "@/lib/ai";
import { ItemTags } from "@/lib/ai/schemas/common";
import { runBuyCheck } from "@/lib/check/buy-check";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";

const CheckRequest = z.object({
  title: z.string().trim().min(1).max(200),
  tags: ItemTags,
});

// POST { title, tags } → { result } or { unsupported, message }. Checks one
// item against the current user's closet. Nothing about the item is stored
// or cached, so every call asks the model again; the score itself is
// computed in code. Other body fields (price included) are ignored.
export async function POST(request: Request) {
  const parsed = CheckRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid item", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const check = await runBuyCheck(createServerClient(), currentUserId(), parsed.data, {
      judge: judgePairing,
      score: scorePurchase,
    });
    if (!check) return Response.json({ error: "User not found" }, { status: 404 });
    return Response.json(check);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
