import type { Db } from "@/lib/db/server";
import { FEELING_AUDIO_BUCKET, newVoicePath } from "./path";

// A one-time URL the browser PUTs the WAV to, straight to storage: three
// minutes of audio is over the 4.5 MB request limit of a Vercel function.
export async function createVoiceUpload(
  db: Db,
  userId: string,
  itemId: string,
): Promise<{ path: string; uploadUrl: string }> {
  const { data, error } = await db.storage
    .from(FEELING_AUDIO_BUCKET)
    .createSignedUploadUrl(newVoicePath(userId, itemId));
  if (error) throw error;
  return { path: data.path, uploadUrl: data.signedUrl };
}

// The uploaded bytes, or null when nothing is stored at the path.
export async function readVoiceAudio(db: Db, path: string): Promise<Uint8Array | null> {
  const { data, error } = await db.storage.from(FEELING_AUDIO_BUCKET).download(path);
  if (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function removeVoiceAudio(db: Db, path: string): Promise<void> {
  const { error } = await db.storage.from(FEELING_AUDIO_BUCKET).remove([path]);
  if (error) throw error;
}

function isNotFound(error: unknown): boolean {
  const e = error as { status?: number; statusCode?: string };
  return e.status === 404 || e.statusCode === "404" || e.status === 400;
}
