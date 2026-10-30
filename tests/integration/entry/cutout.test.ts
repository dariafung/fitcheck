import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/items/cutout/route";
import * as ai from "@/lib/ai";
import { AiBudgetError } from "@/lib/ai/errors";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { createServerClient } from "@/lib/db/server";
import { ITEM_IMAGES_BUCKET, storeImage } from "@/lib/entry/images";
import { createTestUser, jsonRequest, removeTestUser } from "./helpers";

// Spies on the model call while keeping the mock answer (the photo as it came).
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, segmentGarment: vi.fn(actual.segmentGarment) };
});

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));

const db = createServerClient();
const tags: ItemTags = { category: "bottom", colors: [{ name: "white" }], materials: ["cotton"], formality: 2, occasions: ["social"] };
let photoPath = "";

beforeAll(async () => {
  user.id = await createTestUser();
  const photo = await sharp({ create: { width: 120, height: 150, channels: 3, background: "#c33" } }).webp().toBuffer();
  photoPath = await storeImage(db, user.id, photo);
});
afterAll(() => removeTestUser(user.id));

async function cutout(body: unknown) {
  const res = await POST(jsonRequest("/api/items/cutout", body));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/items/cutout", () => {
  it("stores the cut-out photo next to the original and hands back both its path and URL", async () => {
    const { status, body } = await cutout({ path: photoPath, title: "White mini skirt", tags });
    expect(status).toBe(200);
    expect(body.path).toMatch(new RegExp(`^${user.id}/[0-9a-f-]{36}\\.webp$`));
    expect(body.path).not.toBe(photoPath);
    expect(body.url).toMatch(/^http/);

    const [input] = vi.mocked(ai.segmentGarment).mock.calls[0];
    expect(input).toMatchObject({ category: "bottom", image: { kind: "inline", mime: "image/png" } });
    expect(input.description).toContain("White mini skirt");

    const { data } = await db.storage.from(ITEM_IMAGES_BUCKET).download(body.path);
    expect(await sharp(Buffer.from(await data!.arrayBuffer())).metadata()).toMatchObject({ format: "webp", width: 120 });
    // The original stays until the daily cleanup; the item is saved with one of them.
    expect((await db.storage.from(ITEM_IMAGES_BUCKET).download(photoPath)).error).toBeNull();
  });

  it("keeps the original, without an error status, when the model can't do it", async () => {
    vi.mocked(ai.segmentGarment).mockRejectedValueOnce(new AiBudgetError("segmentGarment"));
    expect(await cutout({ path: photoPath, title: "White mini skirt", tags })).toEqual({
      status: 200,
      body: { error: "not_cleaned" },
    });
  });

  it("only takes the user's own photos", async () => {
    expect((await cutout({ path: `${randomUUID()}/${randomUUID()}.webp`, title: "x", tags })).status).toBe(400);
    expect((await cutout({ path: `${user.id}/${randomUUID()}.webp`, title: "x", tags })).status).toBe(404);
    expect((await cutout({ path: photoPath, title: "", tags })).status).toBe(400);
  });
});
