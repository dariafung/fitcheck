import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as fixPOST } from "@/app/api/items/[id]/fix/route";
import { GET as listGET } from "@/app/api/items/[id]/saved-outfits/route";
import { DELETE as unsaveDELETE } from "@/app/api/saved-outfits/[id]/route";
import { POST as savePOST } from "@/app/api/saved-outfits/route";
import * as ai from "@/lib/ai";
import { memoryBudgetStore, setBudgetStore, today } from "@/lib/ai/budget";
import { DEMO_READ_ONLY, DEMO_READ_ONLY_ERROR } from "@/lib/auth/messages";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import { createServerClient } from "@/lib/db/server";
import { DAILY_LIMITS } from "@/lib/limits/daily";
import { memoryUsageStore, setUsageStore, type UsageStore } from "@/lib/limits/usage-store";
import { complaint, ctx, fixCloset, request } from "./fix-helpers";

// Sign-in on, as on the hosted site: the real session, current-user, guard
// and limit code, with only the Supabase Auth call faked.
const claims = vi.hoisted(() => ({ sub: "", session_id: "" }));
vi.mock("@/lib/auth/client", () => ({
  createAuthClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { ...claims, email: `${claims.sub}@example.com` } } }) },
  }),
}));
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, pickFixOutfit: vi.fn(actual.pickFixOutfit) };
});

const db = createServerClient();
const seedFixes = JSON.parse(readFileSync("seed/fix-outfits.json", "utf8")) as {
  item_id: string;
  outfit_item_ids: string[] | null;
  reason: string | null;
}[];
const fix = (id: string) => fixPOST(request("POST", `/api/items/${id}/fix`), ctx(id));
let store: UsageStore;

beforeAll(() => {
  vi.stubEnv("AUTH_REQUIRED", "1");
});
afterAll(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  setBudgetStore(memoryBudgetStore());
  store = memoryUsageStore();
  setUsageStore(store);
  vi.mocked(ai.pickFixOutfit).mockClear();
});

describe("the demo account's fix outfits", () => {
  beforeEach(() => {
    claims.sub = DEMO_USER_ID;
    claims.session_id = "fix-demo-session";
  });

  async function fixRows() {
    const { data } = await db.from("item_fix_outfits").select("*").eq("user_id", DEMO_USER_ID).order("item_id").throwOnError();
    return data;
  }

  it("shows the seeded suggestions and never asks the model", async () => {
    const before = await fixRows();
    if (before.length === 0) throw new Error("Demo persona has no fix outfits: run `pnpm seed` first.");

    for (const seeded of seedFixes) {
      const body = await (await fix(seeded.item_id)).json();
      if (seeded.outfit_item_ids === null) {
        expect(body).toEqual({ state: "no_fix" });
      } else {
        expect(body).toMatchObject({
          state: "suggestion",
          reason: seeded.reason,
          savedId: null,
          outfit: { itemIds: [...seeded.outfit_item_ids].sort() },
        });
      }
    }
    expect(ai.pickFixOutfit).not.toHaveBeenCalled();
    expect(await fixRows()).toEqual(before);
  });

  it("shows nothing for a persona item without a seeded suggestion, such as a low-rated one being passed on", async () => {
    const { data } = await db.from("items").select("id").eq("user_id", DEMO_USER_ID).throwOnError();
    const unseeded = data.map((i) => i.id).filter((id) => !seedFixes.some((f) => f.item_id === id));
    for (const id of unseeded) expect(await (await fix(id)).json()).toEqual({ state: "none" });
    expect(ai.pickFixOutfit).not.toHaveBeenCalled();
  });

  it("can't save, unsave or list saved outfits", async () => {
    const seeded = seedFixes.find((f) => f.outfit_item_ids !== null)!;
    const calls: [string, () => Promise<Response>][] = [
      ["POST /api/saved-outfits", () => savePOST(request("POST", "/api/saved-outfits", { itemIds: seeded.outfit_item_ids }))],
      ["DELETE /api/saved-outfits/[id]", () => unsaveDELETE(request("DELETE", `/api/saved-outfits/${seeded.item_id}`), ctx(seeded.item_id))],
      [
        "GET /api/items/[id]/saved-outfits",
        () => listGET(request("GET", `/api/items/${seeded.item_id}/saved-outfits`), ctx(seeded.item_id)),
      ],
    ];
    for (const [name, call] of calls) {
      const res = await call();
      expect(res.status, name).toBe(403);
      expect(await res.json(), name).toEqual({ error: DEMO_READ_ONLY_ERROR, message: DEMO_READ_ONLY });
    }
    const { count } = await db.from("saved_outfits").select("id", { count: "exact", head: true }).eq("user_id", DEMO_USER_ID).throwOnError();
    expect(count).toBe(0);
  });
});

describe("the daily count of fix outfits", () => {
  let closet: Awaited<ReturnType<typeof fixCloset>>;
  const used = async () => {
    // What is left tells how many were taken.
    let left = 0;
    while (await store.take(`user:${closet.userId}`, today(), "fix", DAILY_LIMITS.fix)) left++;
    for (let i = 0; i < left; i++) await store.giveBack(`user:${closet.userId}`, today(), "fix");
    return DAILY_LIMITS.fix - left;
  };

  beforeEach(async () => {
    closet = await fixCloset();
    claims.sub = closet.userId;
    claims.session_id = "fix-user-session";
  });
  afterEach(async () => {
    await closet.cleanup();
  });

  it("is 20 a day, taken only when the model is asked", async () => {
    expect(DAILY_LIMITS.fix).toBe(20);
    // Nothing to fix, then a closet that can't complete an outfit: the model isn't asked.
    await fix(closet.tee);
    await closet.feel("jeans", complaint());
    await closet.db.from("items").update({ status: "passing_on", size: "8" }).eq("id", closet.sneakers).throwOnError();
    await fix(closet.jeans);
    expect(await used()).toBe(0);

    await closet.db.from("items").update({ status: "active" }).eq("id", closet.sneakers).throwOnError();
    await closet.rate("tee", 2);
    expect((await (await fix(closet.tee)).json()).state).toBe("suggestion");
    expect(await used()).toBe(1);
    // From the cache: not counted.
    await fix(closet.tee);
    expect(await used()).toBe(1);
  });

  it("gives the count back when the model fails", async () => {
    // The skip is logged on the server; the page is told nothing.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await closet.feel("tee", complaint());
    vi.mocked(ai.pickFixOutfit).mockRejectedValueOnce(new ai.AiError("pickFixOutfit failed", "pickFixOutfit", 502));
    expect(await (await fix(closet.tee)).json()).toEqual({ state: "none" });
    expect(await used()).toBe(0);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("pickFixOutfit skipped"));
  });

  it("shows nothing new once the day's count is used up, and keeps what is stored", async () => {
    // The skip is logged on the server; the page is told nothing.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await closet.feel("tee", complaint());
    const first = await (await fix(closet.tee)).json();
    while (await store.take(`user:${closet.userId}`, today(), "fix", DAILY_LIMITS.fix));

    await closet.feel("jeans", complaint());
    const res = await fix(closet.jeans);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: "none" });
    expect(await (await fix(closet.tee)).json()).toEqual(first);
    expect(ai.pickFixOutfit).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("pickFixOutfit skipped"));
  });
});
