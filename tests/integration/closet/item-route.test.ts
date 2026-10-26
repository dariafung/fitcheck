import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/api/items/[id]/route";
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
