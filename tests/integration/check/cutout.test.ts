import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/checks/cutout/route";
import * as ai from "@/lib/ai";
import { AiUpstreamError } from "@/lib/ai/errors";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { jsonRequest } from "../entry/helpers";

// Spies on the model call while keeping the mock answer (the photo as it came).
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, segmentGarment: vi.fn(actual.segmentGarment) };
});

const tags: ItemTags = { category: "top", colors: [{ name: "blue" }], materials: [], formality: 2, occasions: ["social"] };

async function cutout(body: unknown) {
  const res = await POST(jsonRequest("/api/checks/cutout", body));
  return { status: res.status, body: await res.json() };
}

async function photo(): Promise<string> {
  const webp = await sharp({ create: { width: 90, height: 120, channels: 3, background: "#36c" } }).webp().toBuffer();
  return `data:image/webp;base64,${webp.toString("base64")}`;
}

describe("POST /api/checks/cutout", () => {
  it("hands the cut-out photo back without storing anything", async () => {
    const { status, body } = await cutout({ photo: await photo(), title: "Floral corset top", tags });
    expect(status).toBe(200);
    expect(body.photo).toMatch(/^data:image\/webp;base64,/);
    const meta = await sharp(Buffer.from(body.photo.split(",")[1], "base64")).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 90, height: 120 });
    expect(vi.mocked(ai.segmentGarment).mock.calls[0][0]).toMatchObject({ category: "top", image: { mime: "image/png" } });
  });

  it("keeps the original, without an error status, when the model can't do it", async () => {
    vi.mocked(ai.segmentGarment).mockRejectedValueOnce(new AiUpstreamError("segmentGarment", 400));
    expect(await cutout({ photo: await photo(), title: "Top", tags })).toEqual({ status: 200, body: { error: "not_cleaned" } });
    // Not a picture at all.
    const junk = `data:image/png;base64,${Buffer.from("hello").toString("base64")}`;
    expect(await cutout({ photo: junk, title: "Top", tags })).toEqual({ status: 200, body: { error: "not_cleaned" } });
  });

  it("rejects a bad request", async () => {
    expect((await cutout({ photo: "https://example.com/a.png", title: "Top", tags })).status).toBe(400);
    expect((await cutout({ photo: await photo(), title: "Top" })).status).toBe(400);
  });
});
