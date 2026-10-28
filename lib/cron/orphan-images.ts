import type { Db } from "@/lib/db/server";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";

export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;
const MAX_BATCHES = 20;

// Deletes item photos that no item points at and that were uploaded before
// `before`: screenshots cropped during entry but never saved. Returns how
// many were removed. `prefix` limits it to one folder (tests).
export async function deleteOrphanImages(
  db: Db,
  { before, prefix = "" }: { before: Date; prefix?: string },
): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data: names } = await db
      .rpc("orphan_item_images", { p_before: before.toISOString(), p_limit: BATCH, p_prefix: prefix })
      .throwOnError();
    if (!names || names.length === 0) break;
    const { error } = await db.storage.from(ITEM_IMAGES_BUCKET).remove(names);
    if (error) throw error;
    deleted += names.length;
    if (names.length < BATCH) break;
  }
  return deleted;
}
