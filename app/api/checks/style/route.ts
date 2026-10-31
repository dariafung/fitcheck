import sharp from "sharp";
import { z } from "zod";
import { AiError, renderOutfit } from "@/lib/ai";
import { AiBudgetError } from "@/lib/ai/errors";
import { ItemTags } from "@/lib/ai/schemas/common";
import { decodeDataUrl } from "@/lib/check/board-pieces";
import { candidatePiece, ownedStylePieces, styleInput } from "@/lib/check/style";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { toItemWebp } from "@/lib/entry/images";

// A whole board took about 14 s on Muse Image; see lib/ai/live/render-outfit.ts.
export const maxDuration = 300;

// Vercel caps request bodies at 4.5 MB.
const MAX_PHOTO_LENGTH = 4_000_000;

const StyleRequest = z.object({
  candidate: z.object({
    photo: z.string().max(MAX_PHOTO_LENGTH),
    title: z.string().trim().min(1).max(200),
    tags: ItemTags,
  }),
  // The outfit's owned items; with the candidate, 2 to 4 pieces.
  itemIds: z.array(z.uuid()).min(1).max(3),
});

// POST { candidate: { photo, title, tags }, itemIds } → { image } of the
// whole outfit drawn by AI as one board, or { error: "budget" | "failed" }.
// Nothing is stored or cached: the image goes straight back to the page.
// Like the rest of the check it writes nothing, so the read-only demo
// account can use it too, on the shared daily budget.
export async function POST(request: Request) {
  const body = StyleRequest.safeParse(await request.json().catch(() => null));
  const photo = body.success ? decodeDataUrl(body.data.candidate.photo) : null;
  if (!body.success || !photo) return Response.json({ error: "invalid_request" }, { status: 400 });

  const owned = await ownedStylePieces(createServerClient(), await currentUserId(), body.data.itemIds);
  if (owned.kind === "not_owned") return Response.json({ error: "invalid_request" }, { status: 400 });
  if (owned.kind === "no_photo") return Response.json({ error: "failed" });

  const { title, tags } = body.data.candidate;
  // A photo sharp can't read can't be drawn either.
  const input = await styleInput([candidatePiece(title, tags, photo), ...owned.pieces]).catch(() => null);
  if (!input) return Response.json({ error: "failed" });
  let output;
  try {
    output = await renderOutfit(input);
  } catch (err) {
    if (err instanceof AiBudgetError) return Response.json({ error: "budget" });
    if (err instanceof AiError) return Response.json({ error: "failed" });
    throw err;
  }
  const webp = await toItemWebp(sharp(Buffer.from(output.image.base64, "base64")));
  return Response.json({ image: `data:image/webp;base64,${webp.toString("base64")}` });
}
