import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/api/items/[id]/route";
import { PROMPT_VERSION as PAIRING_VERSION } from "@/lib/ai/schemas/judge-pairing";
import { isFresh, type CachedPairing } from "@/lib/check/judge";
import { loadClosetItems } from "@/lib/check/pairings";
import { orderPair } from "@/lib/check/types";
import { createTestCloset } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: async () => user.id }));

let closet: Awaited<ReturnType<typeof createTestCloset>>;
const ctx = () => ({ params: Promise.resolve({ id: closet.itemId }) });
const patch = (body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/items/${closet.itemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(),
  );
async function row() {
  const { data } = await closet.db.from("items").select("rating, updated_at").eq("id", closet.itemId).single().throwOnError();
  return data;
}

beforeEach(async () => {
  closet = await createTestCloset();
  user.id = closet.userId;
});
afterEach(async () => {
  await closet.cleanup();
});

describe("PATCH /api/items/[id] rating", () => {
  it("starts unrated, saves 1 to 5 stars and clears with null", async () => {
    const got = await GET(new Request(`http://localhost/api/items/${closet.itemId}`), ctx());
    expect((await got.json()).item.rating).toBeNull();

    const res = await patch({ rating: 4 });
    expect(res.status).toBe(200);
    expect((await res.json()).item.rating).toBe(4);
    expect((await row()).rating).toBe(4);

    expect((await (await patch({ rating: 1 })).json()).item.rating).toBe(1);
    expect((await (await patch({ rating: null })).json()).item.rating).toBeNull();
    expect((await row()).rating).toBeNull();
  });

  it("turns away anything but whole stars from 1 to 5", async () => {
    for (const rating of [0, 6, 2.5, "5", true]) {
      expect((await patch({ rating })).status, String(rating)).toBe(400);
    }
    expect((await row()).rating).toBeNull();
  });

  it("writes nothing when the rating is the same", async () => {
    await patch({ rating: 3 });
    const before = await row();
    expect((await patch({ rating: 3 })).status).toBe(200);
    expect(await row()).toEqual(before);
  });

  it("doesn't stale the item's cached pairings, while a tag edit still does", async () => {
    const { data: jeans } = await closet.db
      .from("items")
      .insert({
        user_id: closet.userId,
        entry_method: "manual",
        title: "Test jeans",
        category: "bottom",
        ai_tags: { category: "bottom", colors: [{ name: "indigo" }], materials: ["denim"], formality: 2, occasions: ["social"] },
      })
      .select("id, updated_at")
      .single()
      .throwOnError();
    const before = await row();
    // Judged at the items' current version, as saveVerdicts stores it.
    const judged = [before.updated_at, jeans.updated_at].sort((a, b) => Date.parse(a) - Date.parse(b))[1];
    const [a, b] = orderPair(closet.itemId, jeans.id);
    const pairing: CachedPairing = {
      item_a_id: a,
      item_b_id: b,
      pairs: true,
      reason: "Test verdict.",
      source: "ai",
      prompt_version: PAIRING_VERSION,
      created_at: judged,
    };
    const fresh = async () => {
      const { items } = await loadClosetItems(closet.db, closet.userId);
      return isFresh(pairing, new Map(items.map((i) => [i.id, i])));
    };
    expect(await fresh()).toBe(true);

    for (const rating of [2, 5, null]) expect((await patch({ rating })).status).toBe(200);
    expect((await row()).updated_at).toBe(before.updated_at);
    expect(await fresh()).toBe(true);

    // A tag edit changes how the piece pairs: its verdicts are stale, even
    // when a rating is sent along with it.
    const { data: item } = await closet.db.from("items").select("title, brand, ai_tags").eq("id", closet.itemId).single().throwOnError();
    const tags = { ...(item.ai_tags as Record<string, unknown>), formality: 4 };
    expect((await patch({ rating: 4, details: { title: item.title, brand: item.brand, tags } })).status).toBe(200);
    expect(Date.parse((await row()).updated_at)).toBeGreaterThan(Date.parse(before.updated_at));
    expect(await fresh()).toBe(false);
  });

  it("is refused by the database outside 1 to 5", async () => {
    const { error } = await closet.db.from("items").update({ rating: 6 }).eq("id", closet.itemId);
    expect(error?.code).toBe("23514");
  });
});
