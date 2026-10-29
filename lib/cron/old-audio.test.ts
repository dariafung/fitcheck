import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/server";
import { deleteOldAudio } from "./old-audio";

const OLD = "2026-10-01T00:00:00Z";
const NEW = "2026-10-28T00:00:00Z";

// A bucket of `perItem` files under one item folder, served the way Storage
// `list` pages them (folders have a null id).
function fakeDb(perItem: number) {
  const removed: string[][] = [];
  const listCalls: string[] = [];
  const files = Array.from({ length: perItem }, (_, i) => ({
    name: `${String(i).padStart(5, "0")}.wav`,
    id: `f${i}`,
    created_at: i % 2 === 0 ? OLD : NEW,
  }));
  const tree: Record<string, { name: string; id: string | null; created_at: string | null }[]> = {
    "": [{ name: "u1", id: null, created_at: null }],
    u1: [{ name: "i1", id: null, created_at: null }],
    "u1/i1": files,
  };
  const db = {
    storage: {
      from: () => ({
        list: async (folder: string, { limit, offset }: { limit: number; offset: number }) => {
          listCalls.push(folder);
          return { data: (tree[folder] ?? []).slice(offset, offset + limit), error: null };
        },
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { data: [], error: null };
        },
      }),
    },
  } as unknown as Db;
  return { db, removed, listCalls };
}

describe("deleteOldAudio", () => {
  it("pages through big folders and removes old files in batches", async () => {
    const { db, removed, listCalls } = fakeDb(2500);
    const count = await deleteOldAudio(db, { before: new Date("2026-10-27T00:00:00Z") });
    expect(count).toBe(1250);
    expect(listCalls).toEqual(["", "u1", "u1/i1", "u1/i1", "u1/i1"]);
    expect(removed.map((b) => b.length)).toEqual([500, 500, 250]);
    expect(removed[0][0]).toBe("u1/i1/00000.wav");
  });

  it("removes nothing when the bucket is empty", async () => {
    const { db, removed } = fakeDb(0);
    expect(await deleteOldAudio(db, { before: new Date() })).toBe(0);
    expect(removed).toEqual([]);
  });
});
