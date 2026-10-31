import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as cutoutPOST } from "@/app/api/checks/cutout/route";
import { POST as checkExtractPOST } from "@/app/api/checks/extract/route";
import { POST as checkPOST } from "@/app/api/checks/route";
import { POST as stylePOST } from "@/app/api/checks/style/route";
import { POST as feelingPOST } from "@/app/api/items/[id]/feelings/route";
import { POST as extractPOST } from "@/app/api/items/extract/route";
import { POST as pairingsPOST } from "@/app/api/pairings/route";
import * as ai from "@/lib/ai";
import { memoryBudgetStore, recordSpend, setBudgetStore, today } from "@/lib/ai/budget";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import { createServerClient } from "@/lib/db/server";
import { fakeScreenshot } from "@/lib/entry/fake-screenshot";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";
import { DAILY_LIMITS, DEMO_DAILY_LIMITS, DEMO_RESERVE_USD, type DailyAction } from "@/lib/limits/daily";
import { memoryUsageStore, setUsageStore, type UsageStore } from "@/lib/limits/usage-store";
import { jsonRequest, uploadRequest } from "../entry/helpers";

// Sign-in on, as on the hosted site: the real session, current-user, guard
// and limit code, with only the Supabase Auth call faked. Counts live in
// memory (env-setup), filled up front to reach a limit without paying for it.
const claims = vi.hoisted(() => ({ sub: "", session_id: "" }));
vi.mock("@/lib/auth/client", () => ({
  createAuthClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { ...claims, email: `${claims.sub}@example.com` } } }) },
  }),
}));

// Spies on the model calls while keeping the mock answers.
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    extractItem: vi.fn(actual.extractItem),
    segmentGarment: vi.fn(actual.segmentGarment),
    renderOutfit: vi.fn(actual.renderOutfit),
    parseFeeling: vi.fn(actual.parseFeeling),
  };
});

const pending = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
  after: (task: () => Promise<void>) => pending.push(task),
}));

const db = createServerClient();
const userId = randomUUID();
const shirtId = randomUUID();
const photoPath = `${userId}/${randomUUID()}.webp`;
const tags = (category: string): ItemTags =>
  ({ category, colors: [{ name: "navy" }], materials: [], formality: 3, occasions: [] }) as ItemTags;

let store: UsageStore;

async function fill(subject: string, action: DailyAction, limit: number) {
  for (let i = 0; i < limit; i++) await store.take(subject, today(), action, limit);
}

async function shot(): Promise<Blob> {
  return new Blob([new Uint8Array(await fakeScreenshot())], { type: "image/png" });
}

async function photo(): Promise<string> {
  const webp = await sharp({ create: { width: 200, height: 250, channels: 3, background: "#14204f" } }).webp().toBuffer();
  return `data:image/webp;base64,${webp.toString("base64")}`;
}

beforeAll(async () => {
  vi.stubEnv("AUTH_REQUIRED", "1");
  await db.from("users").insert({ id: userId, display_name: "Limits test" }).throwOnError();
  const shot = Buffer.from((await photo()).split(",")[1], "base64");
  const { error } = await db.storage.from(ITEM_IMAGES_BUCKET).upload(photoPath, shot, { contentType: "image/webp" });
  if (error) throw error;
  await db
    .from("items")
    .insert({
      id: shirtId,
      user_id: userId,
      title: "My top",
      entry_method: "manual",
      status: "active",
      image_paths: [photoPath],
      category: "top",
      ai_tags: tags("top"),
      user_tags: {},
    })
    .throwOnError();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await db.from("users").delete().eq("id", userId).throwOnError();
  await db.storage.from(ITEM_IMAGES_BUCKET).remove([photoPath]);
});

beforeEach(() => {
  vi.stubEnv("AI_MODE", "mock");
  store = memoryUsageStore();
  setUsageStore(store);
  setBudgetStore(memoryBudgetStore());
  claims.sub = userId;
  claims.session_id = randomUUID();
  pending.length = 0;
  vi.clearAllMocks();
});

async function expectLimit(res: Response, error: string) {
  expect(res.status).toBe(429);
  expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect((await res.json()).error).toBe(error);
}

describe("an account over its daily limit", () => {
  it("gets 429 for a buy check, before any model call", async () => {
    await fill(`user:${userId}`, "check", DAILY_LIMITS.check);
    await expectLimit(await checkPOST(jsonRequest("/api/checks", { title: "Loafers", tags: tags("shoes") })), "AiDailyLimitError");
  });

  it("gets 429 for reading a screenshot, to add or to check", async () => {
    await fill(`user:${userId}`, "read", DAILY_LIMITS.read);
    await expectLimit(await extractPOST(uploadRequest(await shot())), "AiDailyLimitError");
    await expectLimit(await checkExtractPOST(uploadRequest(await shot())), "AiDailyLimitError");
    expect(ai.extractItem).not.toHaveBeenCalled();
  });

  it("gets 429 for Style it", async () => {
    await fill(`user:${userId}`, "style", DAILY_LIMITS.style);
    const body = { candidate: { photo: await photo(), title: "Loafers", tags: tags("shoes") }, itemIds: [shirtId] };
    await expectLimit(await stylePOST(jsonRequest("/api/checks/style", body)), "AiDailyLimitError");
    expect(ai.renderOutfit).not.toHaveBeenCalled();
  });

  it("keeps the original photo instead of cutting it out", async () => {
    await fill(`user:${userId}`, "cutout", DAILY_LIMITS.cutout);
    const res = await cutoutPOST(jsonRequest("/api/checks/cutout", { photo: await photo(), title: "Top", tags: tags("top") }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ error: "not_cleaned" });
    expect(ai.segmentGarment).not.toHaveBeenCalled();
  });

  it("still saves a feeling, but doesn't read it", async () => {
    await fill(`user:${userId}`, "feeling", DAILY_LIMITS.feeling);
    const req = new Request("http://test/api/items/x/feelings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Fits great." }),
    });
    const res = await feelingPOST(req, { params: Promise.resolve({ id: shirtId }) });
    expect(res.status).toBe(200);
    while (pending.length > 0) await pending.shift()!();
    expect(ai.parseFeeling).not.toHaveBeenCalled();
    const { data } = await db.from("item_feelings").select("raw_text, structured").eq("item_id", shirtId).throwOnError();
    expect(data).toEqual([{ raw_text: "Fits great.", structured: null }]);
  });
});

describe("what doesn't count", () => {
  it("a buy check that never reached the model", async () => {
    // Accessories are turned away before anything is asked.
    for (let i = 0; i < DAILY_LIMITS.check + 2; i++) {
      const res = await checkPOST(jsonRequest("/api/checks", { title: "Tote", tags: tags("accessory") }));
      expect(await res.json()).toMatchObject({ unsupported: "accessory" });
    }
  });

  it("outfits that came from the cache alone", async () => {
    for (let i = 0; i < DAILY_LIMITS.pairings + 2; i++) expect((await pairingsPOST()).status).toBe(200);
  });

  it("nothing, with sign-in off", async () => {
    vi.stubEnv("AUTH_REQUIRED", "");
    await fill(`user:${userId}`, "read", DAILY_LIMITS.read);
    expect((await checkExtractPOST(uploadRequest(await shot()))).status).toBe(200);
    vi.stubEnv("AUTH_REQUIRED", "1");
  });
});

describe("the demo account", () => {
  beforeEach(() => {
    claims.sub = DEMO_USER_ID;
  });

  it("is limited per login", async () => {
    await fill(`demo-session:${claims.session_id}`, "read", DAILY_LIMITS.read);
    await expectLimit(await checkExtractPOST(uploadRequest(await shot())), "AiDemoLimitError");
    claims.session_id = randomUUID();
    expect((await checkExtractPOST(uploadRequest(await shot()))).status).toBe(200);
  });

  it("and as a whole", async () => {
    await fill("demo", "read", DEMO_DAILY_LIMITS.read!);
    await expectLimit(await checkExtractPOST(uploadRequest(await shot())), "AiDemoLimitError");
  });
});

describe("the demo's reserve", () => {
  it("turns other accounts away once only it is left, the demo still gets through", async () => {
    vi.stubEnv("AI_MODE", "live");
    // The model is never reached: only the checks before it run.
    vi.mocked(ai.extractItem).mockRejectedValue(new ai.AiError("not in this test", "extractItem", 500));
    await recordSpend(7 - DEMO_RESERVE_USD);
    const res = await checkExtractPOST(uploadRequest(await shot()));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("AiBudgetError");
    expect(ai.extractItem).not.toHaveBeenCalled();

    claims.sub = DEMO_USER_ID;
    expect((await checkExtractPOST(uploadRequest(await shot()))).status).toBe(500);
    expect(ai.extractItem).toHaveBeenCalledTimes(1);
    vi.mocked(ai.extractItem).mockReset();
  });
});
