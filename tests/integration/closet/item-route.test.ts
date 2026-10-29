import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "@/app/api/items/[id]/route";
import { ITEM_IMAGES_BUCKET } from "@/lib/closet/images";
import { listClosetItems } from "@/lib/closet/items";
import { createTestCloset } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));

let closet: Awaited<ReturnType<typeof createTestCloset>>;

beforeEach(async () => {
  closet = await createTestCloset();
  user.id = closet.userId;
});

afterEach(async () => {
  await closet.cleanup();
});

function get(id: string) {
  return GET(new Request(`http://test/api/items/${id}`), { params: Promise.resolve({ id }) });
}

function del(id: string) {
  return DELETE(new Request(`http://test/api/items/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

// 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

function patch(id: string, body: unknown) {
  return PATCH(
    new Request(`http://test/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("GET /api/items/[id]", () => {
  it("returns the item with merged tags and its feeling text only", async () => {
    await closet.db
      .from("item_feelings")
      .insert({
        item_id: closet.itemId,
        user_id: closet.userId,
        raw_text: "Breezy, love it.",
        source: "typed",
        structured: { flattering: "yes" },
      })
      .throwOnError();

    const res = await get(closet.itemId);
    expect(res.status).toBe(200);
    const { item } = await res.json();
    expect(item).toMatchObject({
      id: closet.itemId,
      title: "Test linen shirt",
      category: "top",
      imageUrls: [],
      tags: { fit: "oversized", materials: ["linen"] },
      tempRangeF: { min: 65, max: 95 },
      feeling: { text: "Breezy, love it." },
    });
    expect(JSON.stringify(item)).not.toContain("flattering");
  });

  it("404s for unknown ids, bad ids and other users' items", async () => {
    expect((await get(randomUUID())).status).toBe(404);
    expect((await get("not-a-uuid")).status).toBe(404);
    user.id = randomUUID();
    expect((await get(closet.itemId)).status).toBe(404);
  });
});

describe("PATCH /api/items/[id]", () => {
  it("stores the range in user_tags, next to other corrections", async () => {
    const res = await patch(closet.itemId, { tempRangeF: { min: 40, max: 70 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tempRangeF: { min: 40, max: 70 } });

    const { data } = await closet.db
      .from("items")
      .select("ai_tags, user_tags")
      .eq("id", closet.itemId)
      .single()
      .throwOnError();
    expect(data.user_tags).toEqual({ fit: "oversized", tempRangeF: { min: 40, max: 70 } });
    expect(data.ai_tags).toMatchObject({ tempRangeF: { min: 65, max: 95 } });

    const { item } = await (await get(closet.itemId)).json();
    expect(item.tempRangeF).toEqual({ min: 40, max: 70 });
  });

  it("rejects seasons, other fields and bad ranges, and 404s for items that are not this user's", async () => {
    expect((await patch(closet.itemId, { seasons: ["fall"] })).status).toBe(400);
    expect((await patch(closet.itemId, { tempRangeF: { min: 40, max: 70 }, title: "New" })).status).toBe(400);
    expect((await patch(closet.itemId, { tempRangeF: { min: 70, max: 40 } })).status).toBe(400);
    expect((await patch("not-a-uuid", { tempRangeF: { min: 40, max: 70 } })).status).toBe(404);
    user.id = randomUUID();
    expect((await patch(closet.itemId, { tempRangeF: { min: 40, max: 70 } })).status).toBe(404);
  });
});

describe("DELETE /api/items/[id]", () => {
  it("deletes the item with its feeling, its pairings and its photo", async () => {
    const { db, userId, itemId } = closet;
    const imagePath = `${userId}/${randomUUID()}.webp`;
    const bucket = db.storage.from(ITEM_IMAGES_BUCKET);
    expect((await bucket.upload(imagePath, PNG, { contentType: "image/webp" })).error).toBeNull();
    await db
      .from("items")
      .update({ image_paths: [imagePath, "https://cdn.example.com/shirt.jpg"] })
      .eq("id", itemId)
      .throwOnError();
    await db
      .from("item_feelings")
      .insert({ item_id: itemId, user_id: userId, raw_text: "Breezy.", source: "typed" })
      .throwOnError();
    const { data: other } = await db
      .from("items")
      .insert({ user_id: userId, entry_method: "manual", title: "Test chinos", category: "bottom" })
      .select("id")
      .single()
      .throwOnError();
    const [a, b] = [itemId, other.id].sort();
    await db
      .from("pairings")
      .insert({ user_id: userId, item_a_id: a, item_b_id: b, pairs: true, source: "rule" })
      .throwOnError();

    const res = await del(itemId);
    expect(res.status).toBe(204);

    expect((await get(itemId)).status).toBe(404);
    expect((await listClosetItems(db, userId)).map((c) => c.id)).toEqual([other.id]);
    const left = await Promise.all([
      db.from("item_feelings").select("id").eq("item_id", itemId).throwOnError(),
      db.from("pairings").select("id").eq("user_id", userId).throwOnError(),
    ]);
    expect(left.map((r) => r.data)).toEqual([[], []]);
    const { data: files } = await bucket.list(userId);
    expect(files).toEqual([]);
  });

  it("404s for unknown ids, bad ids and other users' items, and leaves them alone", async () => {
    expect((await del(randomUUID())).status).toBe(404);
    expect((await del("not-a-uuid")).status).toBe(404);
    user.id = randomUUID();
    expect((await del(closet.itemId)).status).toBe(404);
    user.id = closet.userId;
    expect((await get(closet.itemId)).status).toBe(200);
  });
});
