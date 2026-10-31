import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/checks/style/route";
import * as ai from "@/lib/ai";
import { AiBudgetError, AiUpstreamError } from "@/lib/ai/errors";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { CANDIDATE_ITEM_ID } from "@/lib/check/pairings";
import { createServerClient } from "@/lib/db/server";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";
import { jsonRequest } from "../entry/helpers";

const current = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => current.userId }));

// Spies on the model call while keeping the mock answer.
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, renderOutfit: vi.fn(actual.renderOutfit) };
});

// One user with a shirt and shorts that have photos, photo-less shoes and a
// passed-on jacket; someone else's top. Random ids, removed after.
const db = createServerClient();
const userId = randomUUID();
current.userId = userId;
const otherUserId = randomUUID();
const shirtId = randomUUID();
const shortsId = randomUUID();
const shoesId = randomUUID();
const jacketId = randomUUID();
const otherId = randomUUID();
const shirtPhoto = `${userId}/${randomUUID()}.webp`;
const shortsPhoto = `${userId}/${randomUUID()}.webp`;

const tags = (category: string): ItemTags =>
  ({ category, colors: [{ name: "navy" }], materials: [], formality: 3, occasions: [] }) as ItemTags;

function productShot(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 250, channels: 3, background: "#14204f" } }).webp().toBuffer();
}

async function candidate() {
  return { photo: `data:image/webp;base64,${(await productShot()).toString("base64")}`, title: "Black loafers", tags: tags("shoes") };
}

async function style(body: unknown) {
  const res = await POST(jsonRequest("/api/checks/style", body));
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  await db
    .from("users")
    .insert([
      { id: userId, display_name: "Style test" },
      { id: otherUserId, display_name: "Style test, someone else" },
    ])
    .throwOnError();
  const shot = await productShot();
  for (const path of [shirtPhoto, shortsPhoto]) {
    const { error } = await db.storage.from(ITEM_IMAGES_BUCKET).upload(path, shot, { contentType: "image/webp" });
    if (error) throw error;
  }
  const item = (id: string, user: string, category: string, extra: object = {}) => ({
    id,
    user_id: user,
    title: `My ${category}`,
    entry_method: "manual",
    status: "active",
    image_paths: [] as string[],
    category,
    ai_tags: tags(category),
    user_tags: {},
    ...extra,
  });
  await db
    .from("items")
    .insert([
      item(shirtId, userId, "top", { image_paths: [shirtPhoto] }),
      item(shortsId, userId, "bottom", { image_paths: [shortsPhoto], user_tags: { colors: [{ name: "slate" }] } }),
      item(shoesId, userId, "shoes"),
      item(jacketId, userId, "outerwear", { status: "passing_on", image_paths: [shirtPhoto] }),
      item(otherId, otherUserId, "top", { image_paths: [shirtPhoto] }),
    ])
    .throwOnError();
});

afterAll(async () => {
  await db.from("users").delete().in("id", [userId, otherUserId]).throwOnError();
  await db.storage.from(ITEM_IMAGES_BUCKET).remove([shirtPhoto, shortsPhoto]);
});

describe("POST /api/checks/style", () => {
  it("draws the whole outfit and hands the picture back without storing it", async () => {
    const { status, body } = await style({ candidate: await candidate(), itemIds: [shortsId, shirtId] });
    expect(status).toBe(200);
    expect(body.image).toMatch(/^data:image\/webp;base64,/);
    expect((await sharp(Buffer.from(body.image.split(",")[1], "base64")).metadata()).format).toBe("webp");

    const input = vi.mocked(ai.renderOutfit).mock.calls.at(-1)![0];
    // Top to toe; the user's own tag fixes win.
    expect(input.items.map((i) => i.id)).toEqual([shirtId, shortsId, CANDIDATE_ITEM_ID]);
    expect(input.items[1].description).toContain("colors slate");
    expect(input.items[2].description).toMatch(/^Black loafers: shoes/);
    expect(input.items.every((i) => i.image.kind === "inline" && i.image.mime === "image/png")).toBe(true);
  });

  it("says when the budget is used up or the model fails, without an error status", async () => {
    vi.mocked(ai.renderOutfit).mockRejectedValueOnce(new AiBudgetError("renderOutfit"));
    expect(await style({ candidate: await candidate(), itemIds: [shirtId, shortsId] })).toEqual({
      status: 200,
      body: { error: "budget" },
    });
    vi.mocked(ai.renderOutfit).mockRejectedValueOnce(new AiUpstreamError("renderOutfit", 400));
    expect(await style({ candidate: await candidate(), itemIds: [shirtId, shortsId] })).toEqual({
      status: 200,
      body: { error: "failed" },
    });
  });

  it("fails without a call when a piece has no photo to copy", async () => {
    const calls = vi.mocked(ai.renderOutfit).mock.calls.length;
    const junk = { ...(await candidate()), photo: `data:image/png;base64,${Buffer.from("hello").toString("base64")}` };
    expect((await style({ candidate: junk, itemIds: [shirtId, shortsId] })).body).toEqual({ error: "failed" });
    const noPhoto = { candidate: { ...(await candidate()), tags: tags("top") }, itemIds: [shortsId, shoesId] };
    expect((await style(noPhoto)).body).toEqual({ error: "failed" });
    expect(vi.mocked(ai.renderOutfit).mock.calls.length).toBe(calls);
  });

  it("rejects items that aren't the user's active ones, and bad requests", async () => {
    expect((await style({ candidate: await candidate(), itemIds: [shirtId, jacketId] })).status).toBe(400);
    expect((await style({ candidate: await candidate(), itemIds: [shirtId, otherId] })).status).toBe(400);
    expect((await style({ candidate: await candidate(), itemIds: [] })).status).toBe(400);
    expect((await style({ candidate: { ...(await candidate()), photo: "https://example.com/a.png" }, itemIds: [shirtId] })).status).toBe(400);
    expect((await style({ itemIds: [shirtId] })).status).toBe(400);
  });
});
