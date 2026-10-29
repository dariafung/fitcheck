import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { FEELING_AUDIO_BUCKET } from "@/lib/closet/voice/path";
import { AUDIO_MAX_AGE_MS, deleteOldAudio } from "@/lib/cron/old-audio";
import { createServerClient } from "@/lib/db/server";

// Runs inside one random user folder so other lanes' recordings in the
// shared local bucket are never touched.
const userId = randomUUID();
const db = createServerClient();
const bucket = db.storage.from(FEELING_AUDIO_BUCKET);

async function upload(itemId: string): Promise<string> {
  const path = `${userId}/${itemId}/${randomUUID()}.wav`;
  const { error } = await bucket.upload(path, new Blob([new Uint8Array(8)], { type: "audio/wav" }));
  if (error) throw error;
  return path;
}

async function stored(): Promise<string[]> {
  const paths: string[] = [];
  const { data: items } = await bucket.list(userId);
  for (const item of items ?? []) {
    const { data: files } = await bucket.list(`${userId}/${item.name}`);
    paths.push(...(files ?? []).map((f) => `${userId}/${item.name}/${f.name}`));
  }
  return paths.sort();
}

afterEach(async () => {
  const left = await stored();
  if (left.length) await bucket.remove(left);
});

describe("deleteOldAudio", () => {
  it("removes recordings older than the cutoff in every item folder", async () => {
    const paths = [await upload(randomUUID()), await upload(randomUUID()), await upload(randomUUID())];
    // Old enough: everything uploaded up to a minute from now.
    const before = new Date(Date.now() + 60_000);
    expect(await deleteOldAudio(db, { before, folder: userId })).toBe(paths.length);
    expect(await stored()).toEqual([]);
  });

  it("keeps recordings younger than a day", async () => {
    const fresh = await upload(randomUUID());
    const before = new Date(Date.now() - AUDIO_MAX_AGE_MS);
    expect(await deleteOldAudio(db, { before, folder: userId })).toBe(0);
    expect(await stored()).toEqual([fresh]);
  });

  it("finds nothing in an empty folder", async () => {
    expect(await deleteOldAudio(db, { before: new Date(Date.now() + 60_000), folder: randomUUID() })).toBe(0);
  });
});
