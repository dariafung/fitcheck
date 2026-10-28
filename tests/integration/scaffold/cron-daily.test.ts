import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/daily/route";
import { deleteOrphanImages, ORPHAN_MIN_AGE_MS } from "@/lib/cron/orphan-images";
import { createServerClient } from "@/lib/db/server";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";

// The route's cleanup is spied on: a real run would also remove other
// lanes' old orphans in the shared local bucket.
vi.mock("@/lib/cron/orphan-images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cron/orphan-images")>();
  return { ...actual, deleteOrphanImages: vi.fn(actual.deleteOrphanImages) };
});

const SECRET = "test-cron-secret-0123456789";
const userId = randomUUID();
const db = createServerClient();
const bucket = db.storage.from(ITEM_IMAGES_BUCKET);

function cronRequest(authorization?: string): Request {
  return new Request("http://localhost/api/cron/daily", {
    headers: authorization ? { authorization } : {},
  });
}

afterEach(async () => {
  vi.unstubAllEnvs();
  const { data } = await bucket.list(userId, { limit: 1000 });
  if (data?.length) await bucket.remove(data.map((f) => `${userId}/${f.name}`));
  await db.from("users").delete().eq("id", userId).throwOnError();
});

describe("GET /api/cron/daily", () => {
  it("turns away calls without the cron secret", async () => {
    expect((await GET(cronRequest("Bearer anything"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await GET(cronRequest())).status).toBe(401);
    expect((await GET(cronRequest("Bearer wrong"))).status).toBe(401);
    expect(deleteOrphanImages).not.toHaveBeenCalled();
  });

  it("cleans up photos older than a day when Vercel Cron calls", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.mocked(deleteOrphanImages).mockResolvedValueOnce(2);
    const started = Date.now();
    const res = await GET(cronRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deletedImages: 2 });
    const { before } = vi.mocked(deleteOrphanImages).mock.calls[0][1];
    expect(started - before.getTime()).toBeGreaterThanOrEqual(ORPHAN_MIN_AGE_MS - 1000);
    expect(started - before.getTime()).toBeLessThanOrEqual(ORPHAN_MIN_AGE_MS + 1000);
  });
});

describe("deleteOrphanImages", () => {
  it("removes photos no item points at and keeps the rest", async () => {
    await db.from("users").insert({ id: userId, display_name: "Cron test user" }).throwOnError();
    const kept = `${userId}/${randomUUID()}.webp`;
    const orphan = `${userId}/${randomUUID()}.webp`;
    for (const path of [kept, orphan]) {
      const { error } = await bucket.upload(path, new Blob([new Uint8Array(8)], { type: "image/webp" }));
      if (error) throw error;
    }
    await db
      .from("items")
      .insert({ user_id: userId, entry_method: "screenshot", title: "Kept tee", category: "top", image_paths: [kept] })
      .throwOnError();

    // Old enough: everything uploaded up to a minute from now.
    const before = new Date(Date.now() + 60_000);
    expect(await deleteOrphanImages(db, { before, prefix: `${userId}/` })).toBe(1);

    const { data } = await bucket.list(userId);
    expect(data?.map((f) => `${userId}/${f.name}`)).toEqual([kept]);
  });

  it("leaves photos younger than the cutoff", async () => {
    const fresh = `${userId}/${randomUUID()}.webp`;
    const { error } = await bucket.upload(fresh, new Blob([new Uint8Array(8)], { type: "image/webp" }));
    if (error) throw error;
    expect(await deleteOrphanImages(db, { before: new Date(Date.now() - ORPHAN_MIN_AGE_MS), prefix: `${userId}/` })).toBe(0);
  });
});
