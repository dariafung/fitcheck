import { z } from "zod";
import { aiErrorResponse, transcribe } from "@/lib/ai";
import { requireWriter } from "@/lib/auth/guard";
import { findItemSummary } from "@/lib/closet/items";
import { isVoicePath } from "@/lib/closet/voice/path";
import { readVoiceAudio, removeVoiceAudio } from "@/lib/closet/voice/storage";
import { voiceWavProblem } from "@/lib/closet/voice/wav";
import { createServerClient } from "@/lib/db/server";

// A live transcription can take a while; see the timeouts in lib/ai/live/transcribe.ts.
export const maxDuration = 300;

const VoiceBody = z.object({ path: z.string() });

// Transcribes an uploaded recording and returns the text for the feeling box.
// Nothing is saved: the user edits the text and saves it as a typed feeling
// would be. The recording is deleted whether or not this works; on failure
// the user records again.
export async function POST(req: Request, ctx: RouteContext<"/api/items/[id]/feelings/voice">) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const { id } = await ctx.params;
  const body = VoiceBody.safeParse(await req.json().catch(() => null));
  const db = createServerClient();
  const { userId } = writer;
  const item = await findItemSummary(db, userId, id);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });
  if (!body.success || !isVoicePath(body.data.path, userId, item.id)) {
    return Response.json({ error: "Record again." }, { status: 400 });
  }

  const { path } = body.data;
  const audio = await readVoiceAudio(db, path);
  if (!audio) return Response.json({ error: "Record again." }, { status: 404 });

  try {
    if (voiceWavProblem(audio)) {
      return Response.json({ error: "Record again." }, { status: 400 });
    }
    const { text } = await transcribe({
      audio: { kind: "inline", mime: "audio/wav", base64: Buffer.from(audio).toString("base64") },
      language: "en",
    });
    return Response.json({ text });
  } catch (err) {
    return aiErrorResponse(err);
  } finally {
    await removeVoiceAudio(db, path).catch((err: unknown) => {
      console.error(`Could not delete voice recording ${path}:`, err);
    });
  }
}
