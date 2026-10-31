import { z } from "zod";
import { candidateCutout, MAX_BOARD_ITEMS, ownedCutouts } from "@/lib/check/board-pieces";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";

// Vercel caps request bodies at 4.5 MB; the candidate photo is a WebP the
// check page got from /api/checks/extract, far below that.
const MAX_PHOTO_LENGTH = 4_000_000;

const BoardRequest = z.object({
  candidate: z.object({
    photo: z.string().max(MAX_PHOTO_LENGTH).nullable(),
    onModel: z.boolean(),
  }),
  itemIds: z.array(z.uuid()).max(MAX_BOARD_ITEMS),
});

// POST { candidate: { photo, onModel }, itemIds } → { candidate, items }:
// cut-outs for the outfit boards on the buy-check result. No model call and
// nothing stored, so the read-only demo account can use it too. Items that
// aren't the user's active ones are left out; a photo that can't be cut out
// comes back as null and the page shows it as it is.
export async function POST(request: Request) {
  const parsed = BoardRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid board", issues: parsed.error.issues }, { status: 400 });
  }
  const { candidate, itemIds } = parsed.data;
  const [candidateImage, items] = await Promise.all([
    candidate.photo ? candidateCutout(candidate.photo, candidate.onModel) : null,
    ownedCutouts(createServerClient(), await currentUserId(), itemIds),
  ]);
  return Response.json({ candidate: candidateImage, items });
}
