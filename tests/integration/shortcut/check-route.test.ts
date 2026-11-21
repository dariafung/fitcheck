import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as checkExtractPOST } from "@/app/api/checks/extract/route";
import { POST as checkPOST } from "@/app/api/checks/route";
import { POST } from "@/app/api/shortcut/check/route";
import * as ai from "@/lib/ai";
import { memoryBudgetStore, setBudgetStore, today } from "@/lib/ai/budget";
import { DAILY_LIMIT_NOTICE } from "@/lib/ai/notices";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { createToken, hashToken, newToken, revokeTokens, SHORTCUT_TOKEN_LABEL } from "@/lib/auth/api-token";
import { DEMO_READ_ONLY_ERROR } from "@/lib/auth/messages";
import { BAD_TOKEN_TEXT, DEMO_TEXT, EMPTY_CLOSET_TEXT } from "@/lib/check/quick-check";
import { ACCESSORY_NOTICE } from "@/lib/check/reasons";
import { VERDICTS } from "@/lib/check/verdict";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import { createServerClient } from "@/lib/db/server";
import { fakeScreenshot } from "@/lib/entry/fake-screenshot";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";
import { DAILY_LIMITS, type DailyAction } from "@/lib/limits/daily";
import { memoryUsageStore, setUsageStore, type UsageStore } from "@/lib/limits/usage-store";
import { jsonRequest, uploadRequest } from "../entry/helpers";

// Sign-in on, as on the hosted site. The Shortcut has no session cookie: its
// caller comes from the token alone. The faked session below is only for the
// site's own routes, to show both draw on one daily count.
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
    judgeRepeat: vi.fn(actual.judgeRepeat),
  };
});

const db = createServerClient();
const userId = randomUUID();
const emptyUserId = randomUUID();
const tags = (category: string): ItemTags =>
  ({ category, colors: [{ name: "navy" }], materials: [], formality: 3, occasions: [] }) as ItemTags;

let store: UsageStore;
let token = "";
let emptyToken = "";

async function fill(subject: string, action: DailyAction, limit: number) {
  for (let i = 0; i < limit; i++) await store.take(subject, today(), action, limit);
}

async function png(): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await fakeScreenshot());
}

// The way the Shortcut sends it: the image as the whole body.
function shortcut(body: BodyInit | null, bearer: string | null = token, type = "image/jpeg"): Request {
  return new Request("http://localhost/api/shortcut/check", {
    method: "POST",
    headers: { "content-type": type, ...(bearer && { authorization: `Bearer ${bearer}` }) },
    body,
  });
}

async function rowCounts() {
  const items = await db.from("items").select("id", { count: "exact", head: true }).eq("user_id", userId).throwOnError();
  const { data: files } = await db.storage.from(ITEM_IMAGES_BUCKET).list(userId);
  return { items: items.count, files: files?.length ?? 0 };
}

beforeAll(async () => {
  vi.stubEnv("AUTH_REQUIRED", "1");
  await db
    .from("users")
    .insert([
      { id: userId, display_name: "Shortcut test" },
      { id: emptyUserId, display_name: "Shortcut test, empty closet" },
    ])
    .throwOnError();
  await db
    .from("items")
    .insert(
      ["bottom", "shoes"].map((category) => ({
        user_id: userId,
        title: `My ${category}`,
        entry_method: "manual",
        status: "active",
        category,
        ai_tags: tags(category),
        user_tags: {},
      })),
    )
    .throwOnError();
  token = (await createToken(db, userId)).token;
  emptyToken = (await createToken(db, emptyUserId)).token;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await db.from("users").delete().in("id", [userId, emptyUserId]).throwOnError();
  await db.from("api_tokens").delete().eq("user_id", DEMO_USER_ID).eq("label", "Shortcut test").throwOnError();
});

beforeEach(() => {
  vi.stubEnv("AI_MODE", "mock");
  store = memoryUsageStore();
  setUsageStore(store);
  setBudgetStore(memoryBudgetStore());
  claims.sub = userId;
  claims.session_id = randomUUID();
  vi.clearAllMocks();
});

describe("POST /api/shortcut/check", () => {
  it("reads the screenshot, runs the check and answers score, verdict, title and text", async () => {
    const before = await rowCounts();
    const res = await POST(shortcut(new Uint8Array(await sharp(await fakeScreenshot()).jpeg().toBuffer())));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["score", "text", "title", "verdict"]);
    expect(body.title).toBe("Mock item");
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(body.score).toBeLessThanOrEqual(100);
    expect(Object.values(VERDICTS)).toContain(body.verdict);

    const lines: string[] = body.text.split("\n");
    expect(lines[0]).toBe("Mock item (top)");
    expect(lines[1]).toBe(`${body.score}/100 · ${body.verdict}`);
    expect(lines.slice(2, 7).map((l) => l.replace(/ [\d.]+\/\d+$/, ""))).toEqual([
      "Suits you",
      "Outfits",
      "Revives",
      "Fills a gap",
      "Not a repeat",
    ]);
    expect(lines.length).toBeLessThanOrEqual(8);

    // One read with web search, as on the check page; no cut-out; and the
    // checked item is nowhere afterwards.
    expect(ai.extractItem).toHaveBeenCalledTimes(1);
    expect(vi.mocked(ai.extractItem).mock.calls[0][0]).toMatchObject({
      allowWebSearch: true,
      images: [],
      screenshot: { kind: "inline", mime: "image/jpeg" },
    });
    expect(ai.segmentGarment).not.toHaveBeenCalled();
    expect(ai.judgeRepeat).toHaveBeenCalledTimes(1);
    expect(await rowCounts()).toEqual(before);
  });

  it("takes the screenshot as a form field too", async () => {
    const form = new FormData();
    form.append("screenshot", new Blob([await png()], { type: "image/png" }), "shot.png");
    const res = await POST(
      new Request("http://localhost/api/shortcut/check", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: "Mock item", score: expect.any(Number) });
  });

  it("marks the token used", async () => {
    const started = Date.now();
    await POST(shortcut(await png()));
    const { data } = await db.from("api_tokens").select("last_used_at").eq("user_id", userId).single().throwOnError();
    expect(new Date(data.last_used_at!).getTime()).toBeGreaterThanOrEqual(started - 1000);
  });

  it("says there is nothing to compare with for an empty closet, with no score", async () => {
    const res = await POST(shortcut(await png(), emptyToken));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ score: null, verdict: null, title: "Mock item", text: `Mock item (top)\n${EMPTY_CLOSET_TEXT}` });
  });
});

describe("without a working token", () => {
  it("answers 401 before reading anything", async () => {
    const unknown = newToken().token;
    for (const bearer of [null, "nonsense", unknown]) {
      const res = await POST(shortcut(await png(), bearer));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "bad_token", text: BAD_TOKEN_TEXT });
    }
    expect(ai.extractItem).not.toHaveBeenCalled();
  });

  it("answers 401 once the token is revoked or replaced", async () => {
    const other = randomUUID();
    await db.from("users").insert({ id: other, display_name: "Shortcut test, revoked" }).throwOnError();
    try {
      const first = (await createToken(db, other)).token;
      expect((await POST(shortcut(await png(), first))).status).toBe(200);
      const second = (await createToken(db, other)).token;
      expect((await POST(shortcut(await png(), first))).status).toBe(401);
      expect((await POST(shortcut(await png(), second))).status).toBe(200);
      await revokeTokens(db, other);
      expect((await POST(shortcut(await png(), second))).status).toBe(401);
    } finally {
      await db.from("users").delete().eq("id", other).throwOnError();
    }
  });

  it("goes by the token, not by a session cookie", async () => {
    // Signed in on the site as this user, but no token sent.
    expect((await POST(shortcut(await png(), null))).status).toBe(401);
  });
});

describe("the demo account", () => {
  it("gets 403 even with a token row of its own", async () => {
    const demo = newToken();
    await db
      .from("api_tokens")
      .insert({ user_id: DEMO_USER_ID, token_hash: demo.hash, label: "Shortcut test" })
      .throwOnError();
    const res = await POST(shortcut(await png(), demo.token));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: DEMO_READ_ONLY_ERROR, text: DEMO_TEXT });
    expect(ai.extractItem).not.toHaveBeenCalled();
  });
});

describe("a screenshot that can't be checked", () => {
  async function expectNoScore(res: Response, error: string) {
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ score: null, verdict: null, error });
    expect(body.text.length).toBeGreaterThan(10);
    return body;
  }

  it("answers 200 with a line to show, without asking the model", async () => {
    await expectNoScore(await POST(shortcut(null)), "no_file");
    await expectNoScore(await POST(shortcut("not a picture", token, "text/plain")), "not_image");
    const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    await expectNoScore(await POST(shortcut(new Uint8Array(tiny))), "too_small");
    const big = await POST(shortcut(new Uint8Array(4 * 1024 * 1024 + 1)));
    expect((await expectNoScore(big, "too_large")).text).toContain("JPEG");
    expect(ai.extractItem).not.toHaveBeenCalled();
  });

  it("says so when no product was spotted; the read still counts", async () => {
    const seen = await ai.extractItem({ knownFields: {}, images: [], allowWebSearch: false });
    vi.mocked(ai.extractItem).mockClear();
    vi.mocked(ai.extractItem).mockResolvedValueOnce({ ...seen, recognized: false });
    const body = await expectNoScore(await POST(shortcut(await png())), "unrecognized");
    expect(body.title).toBeNull();
    expect(await store.take(`user:${userId}`, today(), "read", 1)).toBe(false);
    expect(await store.take(`user:${userId}`, today(), "check", 1)).toBe(true);
  });

  it("turns an accessory away, showing what was read; no check is counted", async () => {
    const tote = await ai.extractItem({
      knownFields: { title: "Canvas Tote", category: "accessory" },
      images: [],
      allowWebSearch: false,
    });
    vi.mocked(ai.extractItem).mockClear();
    vi.mocked(ai.extractItem).mockResolvedValueOnce(tote);
    const body = await expectNoScore(await POST(shortcut(await png())), "accessory");
    expect(body).toMatchObject({ title: "Canvas Tote", text: `Canvas Tote (accessory)\n${ACCESSORY_NOTICE}` });
    expect(ai.judgeRepeat).not.toHaveBeenCalled();
    expect(await store.take(`user:${userId}`, today(), "check", 1)).toBe(true);
  });
});

describe("daily limits, shared with the site", () => {
  async function expectLimit(res: Response) {
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await res.json()).toMatchObject({ error: "AiDailyLimitError", text: DAILY_LIMIT_NOTICE });
  }

  it("gets 429 once the account's reads are used up, before any model call", async () => {
    await fill(`user:${userId}`, "read", DAILY_LIMITS.read);
    await expectLimit(await POST(shortcut(await png())));
    expect(ai.extractItem).not.toHaveBeenCalled();
  });

  it("gets 429 once its checks are used up", async () => {
    await fill(`user:${userId}`, "check", DAILY_LIMITS.check);
    await expectLimit(await POST(shortcut(await png())));
    expect(ai.judgeRepeat).not.toHaveBeenCalled();
  });

  it("uses up the same counts the site's check does", async () => {
    await fill(`user:${userId}`, "read", DAILY_LIMITS.read - 1);
    await fill(`user:${userId}`, "check", DAILY_LIMITS.check - 1);
    expect((await POST(shortcut(await png()))).status).toBe(200);
    const shot = new Blob([await png()], { type: "image/png" });
    expect((await checkExtractPOST(uploadRequest(shot))).status).toBe(429);
    expect((await checkPOST(jsonRequest("/api/checks", { title: "Loafers", tags: tags("shoes") }))).status).toBe(429);
  });

  it("counts nothing with sign-in off, like the site", async () => {
    vi.stubEnv("AUTH_REQUIRED", "");
    await fill(`user:${userId}`, "read", DAILY_LIMITS.read);
    expect((await POST(shortcut(await png()))).status).toBe(200);
    vi.stubEnv("AUTH_REQUIRED", "1");
  });
});

describe("what is kept", () => {
  it("is the token's hash, never the token", async () => {
    const { data } = await db.from("api_tokens").select("*").eq("user_id", userId).single().throwOnError();
    expect(data.token_hash).toBe(hashToken(token));
    expect(data.label).toBe(SHORTCUT_TOKEN_LABEL);
    expect(JSON.stringify(data)).not.toContain(token);
  });
});
