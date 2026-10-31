import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/items/[id]/buyers/route";
import * as ai from "@/lib/ai";
import { today } from "@/lib/ai/budget";
import { DAILY_LIMITS } from "@/lib/limits/daily";
import { MIN_BUYER_CLOSET } from "@/lib/resale/pool";
import { memoryUsageStore, setUsageStore, type UsageStore } from "@/lib/limits/usage-store";
import { createTestCloset } from "../closet/helpers";

// Sign-in on, signed in as the seller; only the Supabase Auth call is faked.
const claims = vi.hoisted(() => ({ sub: "" }));
vi.mock("@/lib/auth/client", () => ({
  createAuthClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: claims.sub, email: "seller@example.com", session_id: "s" } } }) },
  }),
}));

vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, judgePairing: vi.fn(actual.judgePairing), judgeRepeat: vi.fn(actual.judgeRepeat) };
});

let closet: Awaited<ReturnType<typeof createTestCloset>>;
let buyerId = "";
let store: UsageStore;

// One opted-in buyer who wants the most social outfits there are, so they
// come first for the seller's social top whoever else is in the shared pool.
beforeEach(async () => {
  vi.stubEnv("AUTH_REQUIRED", "1");
  vi.clearAllMocks();
  store = memoryUsageStore();
  setUsageStore(store);
  closet = await createTestCloset();
  claims.sub = closet.userId;
  await closet.db.from("items").update({ status: "passing_on", size: "M" }).eq("id", closet.itemId).throwOnError();
  buyerId = randomUUID();
  await closet.db
    .from("users")
    .insert({
      id: buyerId,
      display_name: "Limits test buyer",
      resale_opt_in: true,
      top_size: "M",
      bottom_size: "M",
      shoe_size: "W8",
      body_shape: "pear",
      lifestyle_mix: { work: 0, school: 0, social: 30, sport: 0, home: 0 },
    })
    .throwOnError();
  const tags = (category: string) => ({ category, colors: [{ name: "black" }], materials: [], formality: 2, occasions: ["social"] });
  await closet.db
    .from("items")
    .insert(
      Array.from({ length: MIN_BUYER_CLOSET }, (_, i) => {
        const category = i % 2 === 0 ? "bottom" : "shoes";
        return { user_id: buyerId, entry_method: "manual", title: `Buyer ${category} ${i}`, category, ai_tags: tags(category) };
      }),
    )
    .throwOnError();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await closet.cleanup();
  await closet.db.from("users").delete().eq("id", buyerId).throwOnError();
});

async function open() {
  return POST(new Request("http://test", { method: "POST" }), { params: Promise.resolve({ id: closet.itemId }) });
}

async function matched() {
  const { data } = await closet.db
    .from("resale_matches")
    .select("buyer_id")
    .eq("item_id", closet.itemId)
    .eq("buyer_id", buyerId)
    .throwOnError();
  return data.length;
}

describe("POST /api/items/[id]/buyers with daily limits", () => {
  it("checks new buyers once per counted opening", async () => {
    expect((await open()).status).toBe(200);
    expect(await matched()).toBe(1);
    // That opening took one count of the seller's buyers limit.
    const subject = `user:${closet.userId}`;
    for (let i = 1; i < DAILY_LIMITS.buyers; i++) expect(await store.take(subject, today(), "buyers", DAILY_LIMITS.buyers)).toBe(true);
    expect(await store.take(subject, today(), "buyers", DAILY_LIMITS.buyers)).toBe(false);
  });

  it("checks no one new once the seller's count is used up, and still answers", async () => {
    for (let i = 0; i < DAILY_LIMITS.buyers; i++) await store.take(`user:${closet.userId}`, today(), "buyers", DAILY_LIMITS.buyers);
    expect((await open()).status).toBe(200);
    expect(await matched()).toBe(0);
    expect(ai.judgePairing).not.toHaveBeenCalled();
    expect(ai.judgeRepeat).not.toHaveBeenCalled();
  });
});
