import { aiErrorResponse, buildProfile } from "@/lib/ai";
import { requireWriter } from "@/lib/auth/guard";
import { refreshStyleCard } from "@/lib/closet/style-profile";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import { createServerClient } from "@/lib/db/server";

// Called by home when the style card is stale; there is no button. Answers
// the card, 202 when another request is already rebuilding it (or one just
// did), or 400 with too few parsed feelings.
export async function POST() {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  // The persona's card comes from the seed, even with sign-in off.
  if (writer.userId === DEMO_USER_ID) {
    return Response.json({ error: "SeedCard" }, { status: 403 });
  }

  try {
    const result = await refreshStyleCard(createServerClient(), writer.userId, (input) => buildProfile(input));
    if (result.status === "not_enough") return Response.json({ error: "NotEnoughFeelings" }, { status: 400 });
    if (result.status === "busy") return Response.json({ busy: true }, { status: 202 });
    return Response.json({ card: result.card });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
