import { FEELING_AUDIO_BUCKET } from "@/lib/closet/voice/path";
import type { Db } from "@/lib/db/server";

export const AUDIO_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PAGE = 1000;
const BATCH = 500;

// Deletes voice recordings uploaded before `before`. A recording is removed
// once it is transcribed, so these are uploads that never got that far (page
// closed, transcription failed). Recordings sit at <userId>/<itemId>/<file>
// and Storage `list` is not recursive, so this walks the folders. Returns how
// many were removed. `folder` limits it to one folder (tests).
export async function deleteOldAudio(
  db: Db,
  { before, folder = "" }: { before: Date; folder?: string },
): Promise<number> {
  const old = await listOld(db, folder, before.getTime());
  for (let i = 0; i < old.length; i += BATCH) {
    const { error } = await db.storage.from(FEELING_AUDIO_BUCKET).remove(old.slice(i, i + BATCH));
    if (error) throw error;
  }
  return old.length;
}

async function listOld(db: Db, folder: string, before: number): Promise<string[]> {
  const old: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage
      .from(FEELING_AUDIO_BUCKET)
      .list(folder, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const entry of data) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.id === null) old.push(...(await listOld(db, path, before)));
      else if (entry.created_at && Date.parse(entry.created_at) < before) old.push(path);
    }
    if (data.length < PAGE) return old;
  }
}
