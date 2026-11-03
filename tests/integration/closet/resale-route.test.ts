import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/items/[id]/buyers/route";
import * as ai from "@/lib/ai";
import { AiBudgetError } from "@/lib/ai/errors";
import { toSellerItem } from "@/lib/resale/buyers";
import { MAX_NEW_CHECKS } from "@/lib/resale/check-buyers";
import { buyerStates, fingerprint } from "@/lib/resale/fingerprint";
import { suitsYou } from "@/lib/resale/feed";
import { buyerPool } from "@/lib/resale/pool";
import { FALLBACK_SUMMARY } from "@/lib/resale/reason-filter";
import { createTestCloset } from "./helpers";

// Spies on the model calls while keeping the mock answers.
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    judgePairing: vi.fn(actual.judgePairing),
    judgeRepeat: vi.fn(actual.judgeRepeat),
    scorePurchase: vi.fn(actual.scorePurchase),
    renderOutfit: vi.fn(actual.renderOutfit),
    segmentGarment: vi.fn(actual.segmentGarment),
  };
});

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));

// The local database is shared, so other users may be opted in too: these
// tests only look at the buyers they make, never at who else is in the pool.
// Their buyers want 30 social outfits a season, the most there is, so they
// come first for the seller's social top.
let closet: Awaited<ReturnType<typeof createTestCloset>>;
const made: string[] = [];

beforeEach(async () => {
  vi.clearAllMocks();
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

function itemTags(category: string) {
  return { category, colors: [{ name: "black" }], materials: [], formality: 2, occasions: ["social"] };
}

// Bottoms and shoes, so the seller's top makes outfits; one liked feeling,
// so the fit questions go to the model.
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
      body_shape: "pear",
      lifestyle_mix: { work: 0, school: 0, social: 30, sport: 0, home: 0 },
    })
    .throwOnError();
  if (count > 0) {
    const { data: items } = await db
      .from("items")
      .insert(
        Array.from({ length: count }, (_, i) => {
          const category = i % 2 === 0 ? "bottom" : "shoes";
          return {
            user_id: id,
            entry_method: "manual",
            title: `Buyer ${category} ${i}`,
            category,
            ai_tags: itemTags(category),
          };
        }),
      )
      .select("id")
      .throwOnError();
    await db
      .from("item_feelings")
      .insert({
        user_id: id,
        item_id: items[0].id,
        raw_text: "Love the color.",
        source: "typed",
        structured: {
          liked: "yes",
          flattering: "yes",
          mood: [],
          occasions: [],
          summary: "Loves the color.",
          aspects: [{ aspect: "color", sentiment: "positive", said: "Love the color", means: "Love the color" }],
        },
        parsed_at: new Date().toISOString(),
      })
      .throwOnError();
  }
  return id;
}

// A cached check that's up to date, so opening the item asks no model.
async function cached(buyerId: string, score: number) {
  const { data: item } = await closet.db
    .from("items")
    .select("title, category, ai_tags, user_tags, image_paths")
    .eq("id", closet.itemId)
    .single()
    .throwOnError();
  const state = (await buyerStates(closet.db, [buyerId])).get(buyerId)!;
  await closet.db
    .from("resale_matches")
    .insert({
      item_id: closet.itemId,
      buyer_id: buyerId,
      seller_id: closet.userId,
      fingerprint: fingerprint(toSellerItem(item), state, "mock"),
      score,
    })
    .throwOnError();
}

async function rows() {
  const { data } = await closet.db
    .from("resale_matches")
    .select("buyer_id, fingerprint, score, highlights, buyer_reasons")
    .eq("item_id", closet.itemId)
    .throwOnError();
  return data;
}

// Buy checks run, counted by judgeRepeat: one call per buyer with clothes.
function checksRun() {
  return vi.mocked(ai.judgeRepeat).mock.calls.length;
}

function post(id: string) {
  return POST(new Request(`http://test/api/items/${id}/buyers`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

async function open() {
  const res = await post(closet.itemId);
  expect(res.status).toBe(200);
  return res.json();
}

describe("buyerPool", () => {
  it("takes opted-in real users with sizes and a closet, whose size fits", async () => {
    const fits = await buyer();
    const near = await buyer({ top: "L" });
    const tooBig = await buyer({ top: "XXL" });
    const notIn = await buyer({ optIn: false });
    const neighbor = await buyer({ seed: true });
    const noSizes = await buyer({ top: null });
    const smallCloset = await buyer({ closet: 2 });

    const pool = await buyerPool(closet.db, { id: closet.userId, isSeed: false }, { category: "top", size: "M" });
    expect(pool.state).toBe("ok");
    const ids = pool.state === "ok" ? pool.buyerIds : [];
    expect(ids).toEqual(expect.arrayContaining([fits, near]));
    for (const out of [tooBig, notIn, neighbor, noSizes, smallCloset, closet.userId]) {
      expect(ids).not.toContain(out);
    }
  });

  it("matches the demo persona only with seed neighbors, who need no closet", async () => {
    const real = await buyer();
    const neighbor = await buyer({ seed: true });
    const closetless = await buyer({ seed: true, closet: 0 });
    const pool = await buyerPool(closet.db, { id: closet.userId, isSeed: true }, { category: "top", size: "M" });
    const ids = pool.state === "ok" ? pool.buyerIds : [];
    expect(ids).toEqual(expect.arrayContaining([neighbor, closetless]));
    expect(ids).not.toContain(real);
  });

  it("doesn't filter by a size it can't read", async () => {
    const tooBig = await buyer({ top: "XXL" });
    const pool = await buyerPool(closet.db, { id: closet.userId, isSeed: false }, { category: "top", size: "Large Tall" });
    expect(pool.state === "ok" && pool.buyerIds).toContain(tooBig);
  });
});

describe("POST /api/items/[id]/buyers", () => {
  it("checks new buyers from their side, caches the scores, and asks no model the second time", async () => {
    const [a, b] = await Promise.all([buyer(), buyer()]);
    const body = await open();
    expect(["matches", "none_strong"]).toContain(body.state);
    expect(body.seeded).toBe(false);
    const saved = await rows();
    expect(saved.map((r) => r.buyer_id).sort()).toEqual([a, b].sort());
    for (const r of saved) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.highlights.length).toBeGreaterThan(0);
      expect(r.buyer_reasons.length).toBeGreaterThan(0);
    }
    expect(ai.scorePurchase).toHaveBeenCalled();

    vi.clearAllMocks();
    expect((await open()).state).toBe(body.state);
    expect(ai.judgePairing).not.toHaveBeenCalled();
    expect(ai.judgeRepeat).not.toHaveBeenCalled();
    expect(ai.scorePurchase).not.toHaveBeenCalled();
  });

  it("checks again only the buyer whose closet changed", async () => {
    const [changed, same] = await Promise.all([buyer(), buyer()]);
    await open();
    const before = new Map((await rows()).map((r) => [r.buyer_id, r.fingerprint]));

    await closet.db.from("items").update({ title: "Renamed" }).eq("user_id", changed).eq("category", "shoes").throwOnError();
    vi.clearAllMocks();
    await open();
    expect(checksRun()).toBe(1);
    const after = new Map((await rows()).map((r) => [r.buyer_id, r.fingerprint]));
    expect(after.get(changed)).not.toBe(before.get(changed));
    expect(after.get(same)).toBe(before.get(same));
  });

  it("checks everyone again when the seller changes the item's tags", async () => {
    await Promise.all([buyer(), buyer()]);
    await open();
    await closet.db.from("items").update({ user_tags: { fit: "slim" } }).eq("id", closet.itemId).throwOnError();
    vi.clearAllMocks();
    await open();
    expect(checksRun()).toBeGreaterThanOrEqual(2);
  });

  it(`checks at most ${MAX_NEW_CHECKS} new buyers at a time, and says some are still waiting`, async () => {
    await Promise.all(Array.from({ length: MAX_NEW_CHECKS + 1 }, () => buyer()));
    const body = await open();
    expect(checksRun()).toBe(MAX_NEW_CHECKS);
    expect(body.someUnchecked).toBe(true);

    vi.clearAllMocks();
    expect((await open()).someUnchecked).toBe(false);
    expect(checksRun()).toBe(1);
  });

  it("runs one set of checks when the item is opened twice at once", async () => {
    await Promise.all([buyer(), buyer()]);
    const [first, second] = await Promise.all([open(), open()]);
    expect(checksRun()).toBe(2);
    expect(second).toEqual(first);
  });

  it("keeps the checks that finished when one fails, and says the rest are waiting", async () => {
    await Promise.all([buyer(), buyer()]);
    vi.mocked(ai.judgeRepeat).mockRejectedValueOnce(new AiBudgetError("judgeRepeat"));
    const body = await open();
    expect(body.someUnchecked).toBe(true);
    expect(await rows()).toHaveLength(1);
  });

  it("says when no buyer could be checked yet", async () => {
    await buyer();
    vi.mocked(ai.judgeRepeat).mockRejectedValueOnce(new AiBudgetError("judgeRepeat"));
    expect(await open()).toEqual({ state: "unchecked", seeded: false });
  });

  it("leaves the buyer's own rows alone and draws nothing", async () => {
    const id = await buyer();
    const snapshot = async () =>
      Promise.all([
        closet.db.from("users").select("*").eq("id", id).single().throwOnError(),
        closet.db.from("items").select("*").eq("user_id", id).order("id").throwOnError(),
        closet.db.from("item_feelings").select("*").eq("user_id", id).order("id").throwOnError(),
      ]).then((results) => results.map((r) => r.data));
    const before = await snapshot();
    await open();
    expect(await snapshot()).toEqual(before);
    expect(ai.renderOutfit).not.toHaveBeenCalled();
    expect(ai.segmentGarment).not.toHaveBeenCalled();
  });

  it("keeps only reasons a buyer should read", async () => {
    await closet.db.from("items").update({ title: "Tee that hides your hips" }).eq("id", closet.itemId).throwOnError();
    await buyer();
    await open();
    const [row] = await rows();
    expect(row.buyer_reasons[0]).toBe(FALLBACK_SUMMARY);
    expect(row.buyer_reasons.join(" ")).not.toMatch(/hides/i);
  });

  it("counts cached matches at 60 or more, with nothing about who they are or their scores", async () => {
    const [a, b, c] = await Promise.all([buyer(), buyer(), buyer()]);
    await cached(a, 72);
    await cached(b, 91);
    await cached(c, 59);

    const body = await open();
    expect(checksRun()).toBe(0);
    expect(body).toEqual({ state: "matches", count: 2, someUnchecked: false, seeded: false });
    const text = JSON.stringify(body);
    for (const id of [a, b, c]) expect(text).not.toContain(id);
    expect(text).not.toMatch(/Resale test buyer|Buyer (bottom|shoes)|Loves the color|pear/);
  });

  it("drops buyers who opted out or no longer fit the size", async () => {
    const [gone, resized, stays] = await Promise.all([buyer(), buyer(), buyer()]);
    await Promise.all([cached(gone, 80), cached(resized, 85), cached(stays, 70)]);
    await closet.db.from("users").update({ resale_opt_in: false }).eq("id", gone).throwOnError();
    await closet.db.from("users").update({ top_size: "XXL" }).eq("id", resized).throwOnError();

    const body = await open();
    expect(body).toMatchObject({ state: "matches", count: 1 });
  });

  it("says no one is a strong match when every score is under 60", async () => {
    await cached(await buyer(), 45);
    expect(await open()).toEqual({ state: "none_strong", someUnchecked: false, seeded: false });
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

describe("seed neighbors without a closet", () => {
  // The demo persona's side: seed neighbors have only a name and sizes, and
  // count through their seeded cached checks alone.
  beforeEach(async () => {
    await closet.db.from("users").update({ is_seed: true }).eq("id", closet.userId).throwOnError();
  });

  it("count from a fresh cached check, and nothing asks the model", async () => {
    const strong = await buyer({ seed: true, closet: 0 });
    const weak = await buyer({ seed: true, closet: 0 });
    await cached(strong, 81);
    await cached(weak, 41);
    const result = await open();
    expect(result).toMatchObject({ seeded: true, state: "matches" });
    // Other seeded buyers in the shared database may be in the pool too, so
    // this looks at these two only: their cached checks stand, unchanged.
    const cachedRows = await rows();
    expect(cachedRows.find((r) => r.buyer_id === strong)?.score).toBe(81);
    expect(cachedRows.find((r) => r.buyer_id === weak)?.score).toBe(41);
  });

  it("are never checked when their cached check is missing or stale", async () => {
    const unchecked = await buyer({ seed: true, closet: 0 });
    const stale = await buyer({ seed: true, closet: 0 });
    await cached(stale, 90);
    await closet.db.from("resale_matches").update({ fingerprint: "old" }).eq("buyer_id", stale).throwOnError();
    await open();
    const after = await rows();
    expect(after.map((r) => r.buyer_id)).not.toContain(unchecked);
    expect(after.find((r) => r.buyer_id === stale)).toMatchObject({ fingerprint: "old", score: 90 });
  });
});

describe("suitsYou", () => {
  async function listed(score: number, reasons: string[]) {
    await closet.db
      .from("items")
      .update({ asking_price_cents: 1500, condition: "like_new" })
      .eq("id", closet.itemId)
      .throwOnError();
    const id = await buyer();
    await cached(id, score);
    await closet.db
      .from("resale_matches")
      .update({ buyer_reasons: reasons })
      .eq("item_id", closet.itemId)
      .eq("buyer_id", id)
      .throwOnError();
    return id;
  }

  it("shows a buyer the pieces that scored 60 or more for them, with the listing and their reasons", async () => {
    const id = await listed(72, ["Goes with your black jeans."]);
    const pieces = await suitsYou(closet.db, id, "mock");
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({
      id: closet.itemId,
      size: "M",
      askingPriceCents: 1500,
      condition: "like_new",
      reasons: ["Goes with your black jeans."],
    });
    // The seller's picked name, and nothing else about them.
    const { data: seller } = await closet.db.from("users").select("display_name").eq("id", closet.userId).single();
    expect(pieces[0].sellerName).toBe(seller?.display_name);
    // Nothing about the seller.
    expect(JSON.stringify(pieces)).not.toContain(closet.userId);
    // The seller doesn't see their own piece.
    expect(await suitsYou(closet.db, closet.userId, "mock")).toEqual([]);
  });

  it("leaves out weak matches, stale checks, pieces kept again, and buyers who opted out", async () => {
    const weak = await listed(59, []);
    expect(await suitsYou(closet.db, weak, "mock")).toEqual([]);
    await closet.db.from("resale_matches").delete().eq("item_id", closet.itemId).throwOnError();

    const id = await listed(90, []);
    expect(await suitsYou(closet.db, id, "mock")).toHaveLength(1);
    // Checked in another AI mode: not this check.
    expect(await suitsYou(closet.db, id, "live")).toEqual([]);

    // The buyer's closet changed since the check.
    const { data: theirs } = await closet.db.from("items").select("id").eq("user_id", id).limit(1).throwOnError();
    await closet.db.from("items").update({ title: "Renamed" }).eq("id", theirs[0].id).throwOnError();
    expect(await suitsYou(closet.db, id, "mock")).toEqual([]);
    await closet.db.from("resale_matches").delete().eq("item_id", closet.itemId).throwOnError();
    await cached(id, 90);
    expect(await suitsYou(closet.db, id, "mock")).toHaveLength(1);

    await closet.db.from("users").update({ resale_opt_in: false }).eq("id", id).throwOnError();
    expect(await suitsYou(closet.db, id, "mock")).toEqual([]);
    await closet.db.from("users").update({ resale_opt_in: true }).eq("id", id).throwOnError();

    await closet.db.from("items").update({ status: "active" }).eq("id", closet.itemId).throwOnError();
    expect(await suitsYou(closet.db, id, "mock")).toEqual([]);
  });
});
