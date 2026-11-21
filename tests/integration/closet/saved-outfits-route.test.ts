import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as fixPOST } from "@/app/api/items/[id]/fix/route";
import { GET as listGET } from "@/app/api/items/[id]/saved-outfits/route";
import { DELETE } from "@/app/api/saved-outfits/[id]/route";
import { POST } from "@/app/api/saved-outfits/route";
import { ctx, fixCloset, request } from "./fix-helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: async () => user.id }));

let closet: Awaited<ReturnType<typeof fixCloset>>;
const save = (itemIds: unknown) => POST(request("POST", "/api/saved-outfits", { itemIds }));
const unsave = (id: string) => DELETE(request("DELETE", `/api/saved-outfits/${id}`), ctx(id));
async function listFor(itemId: string): Promise<{ id: string; itemIds: string[]; pieces: { id: string }[] }[]> {
  const res = await listGET(request("GET", `/api/items/${itemId}/saved-outfits`), ctx(itemId));
  expect(res.status).toBe(200);
  return (await res.json()).outfits;
}
async function rows() {
  const { data } = await closet.db.from("saved_outfits").select("id, item_ids").eq("user_id", closet.userId).throwOnError();
  return data;
}

beforeEach(async () => {
  closet = await fixCloset();
  user.id = closet.userId;
});
afterEach(async () => {
  await closet.cleanup();
});

describe("POST /api/saved-outfits", () => {
  it("saves an outfit as its own row, with its pieces sorted", async () => {
    const res = await save([closet.tee, closet.sneakers, closet.jeans]);
    expect(res.status).toBe(201);
    const { outfit } = await res.json();
    const sorted = [closet.tee, closet.jeans, closet.sneakers].sort();
    expect(outfit.itemIds).toEqual(sorted);
    expect(await rows()).toEqual([{ id: outfit.id, item_ids: sorted }]);
  });

  it("answers the outfit already saved when the same pieces are saved again", async () => {
    const first = await (await save([closet.tee, closet.jeans, closet.sneakers])).json();
    const again = await save([closet.sneakers, closet.jeans, closet.tee, closet.tee]);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(first);
    expect(await rows()).toHaveLength(1);
    // A different set of pieces is another outfit.
    expect((await save([closet.tee, closet.jeans, closet.sneakers, closet.blazer])).status).toBe(201);
    expect(await rows()).toHaveLength(2);
  });

  it("turns away one piece, other people's pieces, pieces being passed on and bad bodies", async () => {
    expect((await save([closet.tee])).status).toBe(400);
    expect((await save([closet.tee, closet.tee])).status).toBe(400);
    expect((await save([closet.tee, randomUUID()])).status).toBe(400);
    expect((await save("nope")).status).toBe(400);
    expect((await POST(request("POST", "/api/saved-outfits", { itemIds: [closet.tee, closet.jeans], extra: 1 }))).status).toBe(400);
    await closet.db.from("items").update({ status: "passing_on", size: "S" }).eq("id", closet.jeans).throwOnError();
    expect((await save([closet.tee, closet.jeans])).status).toBe(400);
    expect(await rows()).toEqual([]);
  });
});

describe("GET /api/items/[id]/saved-outfits", () => {
  it("lists a saved outfit on the page of every piece in it, and nowhere else", async () => {
    const { outfit } = await (await save([closet.tee, closet.jeans, closet.sneakers])).json();
    for (const itemId of [closet.tee, closet.jeans, closet.sneakers]) {
      const listed = await listFor(itemId);
      expect(listed.map((o) => o.id)).toEqual([outfit.id]);
      expect(listed[0].pieces.map((p) => p.id).sort()).toEqual(outfit.itemIds);
    }
    expect(await listFor(closet.blazer)).toEqual([]);
  });

  it("leaves out an outfit with a piece that is being passed on or was deleted, and keeps the row", async () => {
    await save([closet.tee, closet.jeans, closet.sneakers]);
    await save([closet.tee, closet.jeans, closet.sneakers, closet.blazer]);
    await closet.db.from("items").update({ status: "passing_on", size: "M" }).eq("id", closet.blazer).throwOnError();
    expect(await listFor(closet.tee)).toHaveLength(1);
    await closet.db.from("items").update({ status: "active" }).eq("id", closet.blazer).throwOnError();
    expect(await listFor(closet.tee)).toHaveLength(2);
    await closet.db.from("items").delete().eq("id", closet.blazer).throwOnError();
    expect(await listFor(closet.tee)).toHaveLength(1);
    expect(await rows()).toHaveLength(2);
  });

  it("answers 404 for an item that isn't the user's", async () => {
    const res = await listGET(request("GET", `/api/items/${randomUUID()}/saved-outfits`), ctx(randomUUID()));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/saved-outfits/[id]", () => {
  it("removes the outfit, once", async () => {
    const { outfit } = await (await save([closet.tee, closet.jeans, closet.sneakers])).json();
    expect((await unsave(outfit.id)).status).toBe(204);
    expect(await rows()).toEqual([]);
    expect((await unsave(outfit.id)).status).toBe(404);
    expect((await unsave("not-an-id")).status).toBe(404);
  });

  it("can't remove someone else's outfit", async () => {
    const { outfit } = await (await save([closet.tee, closet.jeans, closet.sneakers])).json();
    const other = await fixCloset();
    try {
      user.id = other.userId;
      expect((await unsave(outfit.id)).status).toBe(404);
    } finally {
      user.id = closet.userId;
      await other.cleanup();
    }
    expect(await rows()).toHaveLength(1);
  });
});

describe("saving the suggested outfit", () => {
  it("shows on the suggestion as saved, until it is removed", async () => {
    await closet.rate("tee", 1);
    const ask = async () => (await fixPOST(request("POST", `/api/items/${closet.tee}/fix`), ctx(closet.tee))).json();
    const suggestion = await ask();
    expect(suggestion.savedId).toBeNull();

    const { outfit } = await (await save(suggestion.outfit.itemIds)).json();
    expect((await ask()).savedId).toBe(outfit.id);
    // Not tied to the tee: the jeans' page lists it too.
    expect((await listFor(closet.jeans)).map((o) => o.id)).toEqual([outfit.id]);

    await unsave(outfit.id);
    expect((await ask()).savedId).toBeNull();
  });
});
