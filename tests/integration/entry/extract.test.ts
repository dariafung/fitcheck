import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/items/extract/route";
import { createServerClient } from "@/lib/db/server";
import type { ItemDraft } from "@/lib/entry/draft";
import { fakeScreenshot } from "@/lib/entry/fake-screenshot";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/entry/frame";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";
import { createTestUser, removeTestUser, uploadRequest } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));

beforeAll(async () => {
  user.id = await createTestUser();
});
afterAll(() => removeTestUser(user.id));

async function extract(file?: Blob) {
  const res = await POST(uploadRequest(file));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/items/extract", () => {
  it("turns a screenshot into a draft with the product photo cropped out and framed on white", async () => {
    const { status, body } = await extract(new Blob([new Uint8Array(await fakeScreenshot())], { type: "image/png" }));
    expect(status).toBe(200);
    const draft = body.draft as ItemDraft;
    expect(draft).toMatchObject({ title: "Mock item", brand: "lululemon", size: "S", tags: { category: "top", colorFamily: "black", tempRangeF: { min: 50, max: 85 } } });
    expect(draft.lowConfidence).not.toContain("image");
    expect(draft.imagePaths).toEqual([expect.stringMatching(new RegExp(`^${user.id}/[0-9a-f-]{36}\\.webp$`))]);
    expect(draft.imageUrls).toHaveLength(1);
    expect(draft.rawSource).toMatchObject({ cropped: true, screenshot: { width: 1170, height: 2000 } });

    const { data: blob } = await createServerClient()
      .storage.from(ITEM_IMAGES_BUCKET)
      .download(draft.imagePaths[0]);
    const stored = Buffer.from(await blob!.arrayBuffer());
    expect(await sharp(stored).metadata()).toMatchObject({
      format: "webp",
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    });
    // The photo's own (busy) background stays; the canvas around it is white.
    const corner = await sharp(stored).extract({ left: 0, top: 0, width: 8, height: 8 }).toBuffer();
    expect((await sharp(corner).stats()).channels[1].min).toBeGreaterThanOrEqual(250);
    const { dominant } = await sharp(stored).stats();
    expect(dominant.r).toBeGreaterThan(150);
  });

  // Unusable uploads are expected outcomes: 200 with an error code, so the
  // browser doesn't log a failed request.
  it.each([
    ["nothing", undefined, "no_file"],
    ["text", new Blob(["hello"], { type: "image/png" }), "not_image"],
    ["a tiny image", "tiny", "too_small"],
  ])("answers %s with %s", async (_, file, error) => {
    const upload =
      file === "tiny"
        ? new Blob([await sharp({ create: { width: 120, height: 120, channels: 3, background: "#fff" } }).png().toBuffer()])
        : file;
    expect(await extract(upload as Blob | undefined)).toEqual({ status: 200, body: { error } });
  });
});
