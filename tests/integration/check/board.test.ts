import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/checks/board/route";
import { createServerClient } from "@/lib/db/server";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";

const current = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => current.userId }));

// One user with a flat-lay shirt, an on-model skirt, photo-less shoes and a
// passed-on jacket. Rows and photos use random ids and are removed after.
const db = createServerClient();
const userId = randomUUID();
current.userId = userId;
const otherUserId = randomUUID();
const shirtId = randomUUID();
const skirtId = randomUUID();
const shoesId = randomUUID();
const jacketId = randomUUID();
const otherId = randomUUID();
const shirtPhoto = `${userId}/${randomUUID()}.webp`;
const skirtPhoto = `${userId}/${randomUUID()}.webp`;

// A navy box on a white background.
function productShot(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 250, channels: 3, background: "#ffffff" } })
    .composite([{ input: { create: { width: 100, height: 120, channels: 3, background: "#14204f" } }, left: 50, top: 60 }])
    .webp()
    .toBuffer();
}

const tags = (category: string) => ({ category, colors: [], materials: [], formality: 3, occasions: [] });

async function board(body: unknown, expectStatus = 200) {
  const res = await POST(
    new Request("http://localhost/api/checks/board", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  expect(res.status).toBe(expectStatus);
  return res.json();
}

beforeAll(async () => {
  await db
    .from("users")
    .insert([
      { id: userId, display_name: "Board test" },
      { id: otherUserId, display_name: "Board test, someone else" },
    ])
    .throwOnError();
  const shot = await productShot();
  for (const path of [shirtPhoto, skirtPhoto]) {
    const { error } = await db.storage.from(ITEM_IMAGES_BUCKET).upload(path, shot, { contentType: "image/webp" });
    if (error) throw error;
  }
  const item = (id: string, user: string, category: string, extra: object = {}) => ({
    id,
    user_id: user,
    title: category,
    entry_method: "manual",
    status: "active",
    image_paths: [] as string[],
    on_model: null as boolean | null,
    category,
    ai_tags: tags(category),
    ...extra,
  });
  await db
    .from("items")
    .insert([
      item(shirtId, userId, "top", { image_paths: [shirtPhoto], on_model: false }),
      item(skirtId, userId, "bottom", { image_paths: [skirtPhoto], on_model: true }),
      item(shoesId, userId, "shoes"),
      item(jacketId, userId, "outerwear", { status: "passing_on", image_paths: [shirtPhoto] }),
      item(otherId, otherUserId, "top", { image_paths: [shirtPhoto] }),
    ])
    .throwOnError();
});

afterAll(async () => {
  await db.from("users").delete().in("id", [userId, otherUserId]).throwOnError();
  await db.storage.from(ITEM_IMAGES_BUCKET).remove([shirtPhoto, skirtPhoto]);
});

describe("POST /api/checks/board", () => {
  it("cuts out plain product shots and leaves the rest as they are", async () => {
    const photo = `data:image/webp;base64,${(await productShot()).toString("base64")}`;
    const json = await board({
      candidate: { photo, onModel: false },
      itemIds: [shirtId, skirtId, shoesId, jacketId, otherId],
    });
    expect(json.candidate).toMatch(/^data:image\/webp;base64,/);
    // Only the user's active items come back.
    expect(Object.keys(json.items).sort()).toEqual([shirtId, skirtId, shoesId].sort());
    expect(json.items[shirtId]).toEqual({ category: "top", cutout: expect.stringMatching(/^data:image\/webp;base64,/) });
    // On a model: never cut out, so no person ends up on the board.
    expect(json.items[skirtId]).toEqual({ category: "bottom", cutout: null });
    expect(json.items[shoesId]).toEqual({ category: "shoes", cutout: null });

    const cut = Buffer.from(json.items[shirtId].cutout.split(",")[1], "base64");
    const meta = await sharp(cut).metadata();
    // Trimmed to the navy box.
    expect(meta.width).toBeLessThanOrEqual(102);
    expect(meta.height).toBeLessThanOrEqual(122);
  });

  it("leaves an on-model or missing candidate photo alone", async () => {
    const photo = `data:image/webp;base64,${(await productShot()).toString("base64")}`;
    expect((await board({ candidate: { photo, onModel: true }, itemIds: [] })).candidate).toBeNull();
    expect(await board({ candidate: { photo: null, onModel: false }, itemIds: [] })).toEqual({ candidate: null, items: {} });
    expect((await board({ candidate: { photo: "data:text/plain;base64,aGk=", onModel: false }, itemIds: [] })).candidate).toBeNull();
  });

  it("rejects a bad request", async () => {
    await board({ candidate: { photo: null, onModel: false }, itemIds: ["nope"] }, 400);
    await board({ itemIds: [] }, 400);
    const tooMany = Array.from({ length: 13 }, () => randomUUID());
    await board({ candidate: { photo: null, onModel: false }, itemIds: tooMany }, 400);
  });
});
