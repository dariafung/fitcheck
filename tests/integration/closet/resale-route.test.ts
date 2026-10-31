import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/items/[id]/buyers/route";
import { buyerPool } from "@/lib/resale/pool";
import { createTestCloset } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));

// The local database is shared, so other users may be opted in too: these
// tests only look at the buyers they make, never at who else is in the pool.
let closet: Awaited<ReturnType<typeof createTestCloset>>;
const made: string[] = [];

beforeEach(async () => {
  closet = await createTestCloset();
  user.id = closet.userId;
  await closet.db
    .from("items")
    .update({ status: "passing_on", size: "M" })
    .eq("id", closet.itemId)
    .throwOnError();
});

afterEach(async () => {
  await closet.cleanup();
  if (made.length > 0) await closet.db.from("users").delete().in("id", made.splice(0)).throwOnError();
});

interface BuyerSetup {
  top?: string | null;
  optIn?: boolean;
  seed?: boolean;
  closet?: number;
}

async function buyer({ top = "M", optIn = true, seed = false, closet: count = 3 }: BuyerSetup = {}) {
  const id = randomUUID();
  made.push(id);
  const { db } = closet;
  await db
    .from("users")
    .insert({
      id,
      display_name: "Resale test buyer",
      resale_opt_in: optIn,
      is_seed: seed,
      top_size: top,
      bottom_size: "M",
      shoe_size: "W8",
    })
    .throwOnError();
  if (count > 0) {
    await db
      .from("items")
      .insert(
        Array.from({ length: count }, (_, i) => ({
          user_id: id,
          entry_method: "manual",
          title: `Buyer item ${i}`,
          category: "top",
        })),
      )
      .throwOnError();
  }
  return id;
}

async function cached(buyerId: string, score: number) {
  await closet.db
    .from("resale_matches")
    .insert({ item_id: closet.itemId, buyer_id: buyerId, seller_id: closet.userId, fingerprint: "test", score })
    .throwOnError();
}

function post(id: string) {
  return POST(new Request(`http://test/api/items/${id}/buyers`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("buyerPool", () => {
  it("takes opted-in real users with sizes and a closet, whose size fits", async () => {
    const fits = await buyer();
    const near = await buyer({ top: "L" });
    const tooBig = await buyer({ top: "XXL" });
    const notIn = await buyer({ optIn: false });
    const sample = await buyer({ seed: true });
    const noSizes = await buyer({ top: null });
    const smallCloset = await buyer({ closet: 2 });

    const pool = await buyerPool(closet.db, { id: closet.userId, isSeed: false }, { category: "top", size: "M" });
    expect(pool.state).toBe("ok");
    const ids = pool.state === "ok" ? pool.buyerIds : [];
    expect(ids).toEqual(expect.arrayContaining([fits, near]));
    for (const out of [tooBig, notIn, sample, noSizes, smallCloset, closet.userId]) {
      expect(ids).not.toContain(out);
    }
  });

  it("matches the demo persona only with sample buyers", async () => {
    const real = await buyer();
    const sample = await buyer({ seed: true });
    const pool = await buyerPool(closet.db, { id: closet.userId, isSeed: true }, { category: "top", size: "M" });
    const ids = pool.state === "ok" ? pool.buyerIds : [];
    expect(ids).toContain(sample);
    expect(ids).not.toContain(real);
  });

  it("doesn't filter by a size it can't read", async () => {
    const tooBig = await buyer({ top: "XXL" });
    const pool = await buyerPool(closet.db, { id: closet.userId, isSeed: false }, { category: "top", size: "Large Tall" });
    expect(pool.state === "ok" && pool.buyerIds).toContain(tooBig);
  });
});

describe("POST /api/items/[id]/buyers", () => {
  it("lists cached matches at 60 or more, best first, with nothing about who they are", async () => {
    const [a, b, c] = await Promise.all([buyer(), buyer(), buyer()]);
    await cached(a, 72);
    await cached(b, 91);
    await cached(c, 59);

    const res = await post(closet.itemId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe("matches");
    expect(body.matches.map((m: { score: number }) => m.score)).toEqual([91, 72]);
    for (const m of body.matches) expect(Object.keys(m).sort()).toEqual(["color", "key", "score"]);
    const text = JSON.stringify(body);
    for (const id of [a, b, c]) expect(text).not.toContain(id);
    expect(text).not.toContain("Resale test buyer");
  });

  it("drops buyers who opted out or no longer fit the size", async () => {
    const [gone, resized, stays] = await Promise.all([buyer(), buyer(), buyer()]);
    await Promise.all([cached(gone, 80), cached(resized, 85), cached(stays, 70)]);
    await closet.db.from("users").update({ resale_opt_in: false }).eq("id", gone).throwOnError();
    await closet.db.from("users").update({ top_size: "XXL" }).eq("id", resized).throwOnError();

    const body = await (await post(closet.itemId)).json();
    expect(body.matches.map((m: { score: number }) => m.score)).toEqual([70]);
  });

  it("says no one is a strong match when every cached score is under 60", async () => {
    await cached(await buyer(), 45);
    expect(await (await post(closet.itemId)).json()).toEqual({ state: "none_strong" });
  });

  it("refuses items that aren't passing on, accessories, and items that aren't the user's", async () => {
    await closet.db.from("items").update({ status: "active" }).eq("id", closet.itemId).throwOnError();
    expect((await post(closet.itemId)).status).toBe(409);
    await closet.db
      .from("items")
      .update({ status: "passing_on", category: "accessory" })
      .eq("id", closet.itemId)
      .throwOnError();
    expect((await post(closet.itemId)).status).toBe(409);

    expect((await post("not-a-uuid")).status).toBe(404);
    expect((await post(randomUUID())).status).toBe(404);
    user.id = await buyer();
    expect((await post(closet.itemId)).status).toBe(404);
  });

  it("drops cached matches with the item", async () => {
    const id = await buyer();
    await cached(id, 88);
    await closet.db.from("items").delete().eq("id", closet.itemId).throwOnError();
    const { data } = await closet.db.from("resale_matches").select("item_id").eq("buyer_id", id).throwOnError();
    expect(data).toEqual([]);
  });
});
