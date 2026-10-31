import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/app/api/wear/outfits/[id]/route";
import { POST } from "@/app/api/wear/outfits/route";
import { BACKFILL_DAYS, MAX_OUTFITS_PER_DAY } from "@/lib/wear/day";
import { daysAgo, request, wearCloset } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: async () => user.id }));

let closet: Awaited<ReturnType<typeof wearCloset>>;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const log = (body: Record<string, unknown>) =>
  POST(request("POST", "/api/wear/outfits", { id: randomUUID(), date: daysAgo(0), occasion: null, ...body }));

beforeEach(async () => {
  closet = await wearCloset();
  user.id = closet.userId;
});
afterEach(async () => {
  await closet.cleanup();
});

async function rows() {
  const { data } = await closet.db
    .from("outfit_logs")
    .select("id, worn_on, item_ids, occasion")
    .eq("user_id", closet.userId)
    .order("created_at")
    .throwOnError();
  return data;
}

describe("POST /api/wear/outfits", () => {
  it("logs an outfit with its pieces sorted and its occasion", async () => {
    const id = randomUUID();
    const res = await log({ id, itemIds: [closet.tee, closet.jeans], occasion: "school" });
    expect(res.status).toBe(201);
    expect((await res.json()).outfit).toEqual({
      id,
      date: daysAgo(0),
      itemIds: [closet.tee, closet.jeans].sort(),
      occasion: "school",
    });
    expect(await rows()).toHaveLength(1);
  });

  it("logs a second outfit the same day, but not the same pieces twice", async () => {
    expect((await log({ itemIds: [closet.tee, closet.jeans], occasion: "school" })).status).toBe(201);
    expect((await log({ itemIds: [closet.tee, closet.sneakers], occasion: "sport" })).status).toBe(201);
    const again = await log({ itemIds: [closet.jeans, closet.tee], occasion: "sport" });
    expect(again.status).toBe(409);
    expect((await again.json()).error).toBe("duplicate");
    expect(await rows()).toHaveLength(2);
  });

  it("answers a repeated request with the outfit it already logged", async () => {
    const body = { id: randomUUID(), itemIds: [closet.tee] };
    const first = await (await log(body)).json();
    const again = await log(body);
    expect(again.status).toBe(201);
    expect(await again.json()).toEqual(first);
    expect(await rows()).toHaveLength(1);
  });

  it("turns away other people's pieces, empty outfits, bad occasions and days out of range", async () => {
    expect((await log({ itemIds: [randomUUID()] })).status).toBe(400);
    expect((await log({ itemIds: [] })).status).toBe(400);
    expect((await log({ itemIds: [closet.tee], occasion: "party" })).status).toBe(400);
    const old = await log({ itemIds: [closet.tee], date: daysAgo(BACKFILL_DAYS + 2) });
    expect((await old.json()).error).toBe("too_old");
    expect((await log({ itemIds: [closet.tee], date: daysAgo(-2) })).status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it("caps a day at five outfits", async () => {
    const pieces = [[closet.tee], [closet.jeans], [closet.sneakers], [closet.tee, closet.jeans], [closet.tee, closet.sneakers]];
    for (const itemIds of pieces.slice(0, MAX_OUTFITS_PER_DAY)) expect((await log({ itemIds })).status).toBe(201);
    const full = await log({ itemIds: [closet.jeans, closet.sneakers] });
    expect(full.status).toBe(409);
    expect((await full.json()).error).toBe("day_full");
  });

  it("does nothing while the calendar is off", async () => {
    await closet.db.from("users").update({ wear_log_enabled: false }).eq("id", closet.userId).throwOnError();
    const res = await log({ itemIds: [closet.tee] });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("calendar_off");
  });
});

describe("PATCH and DELETE /api/wear/outfits/[id]", () => {
  async function logged(itemIds: string[], date = daysAgo(0)) {
    return (await (await log({ itemIds, date })).json()).outfit.id as string;
  }

  it("changes the pieces and the occasion", async () => {
    const id = await logged([closet.tee]);
    const res = await PATCH(request("PATCH", `/api/wear/outfits/${id}`, { itemIds: [closet.sneakers, closet.jeans], occasion: "sport" }), ctx(id));
    expect(res.status).toBe(200);
    expect(await rows()).toEqual([
      { id, worn_on: daysAgo(0), item_ids: [closet.sneakers, closet.jeans].sort(), occasion: "sport" },
    ]);
    // Clearing the occasion alone.
    await PATCH(request("PATCH", `/api/wear/outfits/${id}`, { occasion: null }), ctx(id));
    expect((await rows())[0].occasion).toBeNull();
  });

  it("won't turn one outfit into another logged that day", async () => {
    await logged([closet.tee]);
    const id = await logged([closet.jeans]);
    const res = await PATCH(request("PATCH", `/api/wear/outfits/${id}`, { itemIds: [closet.tee] }), ctx(id));
    expect(res.status).toBe(409);
  });

  it("deletes an outfit once", async () => {
    const id = await logged([closet.tee]);
    expect((await DELETE(request("DELETE", `/api/wear/outfits/${id}`), ctx(id))).status).toBe(204);
    expect(await rows()).toEqual([]);
    expect((await DELETE(request("DELETE", `/api/wear/outfits/${id}`), ctx(id))).status).toBe(404);
  });

  it("can't touch someone else's outfit or one too far back", async () => {
    const id = await logged([closet.tee]);
    user.id = randomUUID();
    await closet.db.from("users").insert({ id: user.id, display_name: "Someone else" }).throwOnError();
    try {
      expect((await DELETE(request("DELETE", `/api/wear/outfits/${id}`), ctx(id))).status).toBe(404);
    } finally {
      await closet.db.from("users").delete().eq("id", user.id).throwOnError();
      user.id = closet.userId;
    }
    expect(await rows()).toHaveLength(1);

    const { data } = await closet.db
      .from("outfit_logs")
      .insert({ user_id: closet.userId, worn_on: daysAgo(BACKFILL_DAYS + 5), item_ids: [closet.jeans] })
      .select("id")
      .single()
      .throwOnError();
    const res = await PATCH(request("PATCH", `/api/wear/outfits/${data.id}`, { occasion: "home" }), ctx(data.id));
    expect((await res.json()).error).toBe("too_old");
    expect((await DELETE(request("DELETE", `/api/wear/outfits/${data.id}`), ctx(data.id))).status).toBe(400);
  });
});
