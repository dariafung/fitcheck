// What the extract route does with model answers the mock never gives:
// a product it can't identify, and a box it can't use.
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/items/extract/route";
import type { ExtractItemOutput } from "@/lib/ai";
import { createServerClient } from "@/lib/db/server";
import { fakeScreenshot, PHOTO, SHOT } from "@/lib/entry/fake-screenshot";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/entry/frame";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";
import { padBox } from "@/lib/entry/screenshot";
import { createTestUser, removeTestUser, uploadRequest } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
const answer = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  extractItem: async () => answer.value,
}));

const BASE: ExtractItemOutput = {
  title: "Wrap Midi Dress",
  tags: {
    category: "one_piece",
    colors: [{ name: "rust" }],
    colorFamily: "orange",
    materials: ["crepe"],
    formality: 3,
    tempRangeF: { min: 60, max: 90 },
    occasions: ["social"],
  },
  onModel: true,
  sources: [{ field: "materials", url: "https://example.com/wrap-dress" }],
  lowConfidence: [],
  recognized: true,
  productBox: { x: 0.1, y: 0.12, width: 0.8, height: 0.5 },
};

beforeAll(async () => {
  user.id = await createTestUser();
});
afterAll(() => removeTestUser(user.id));

async function extract(color?: string) {
  const res = await POST(uploadRequest(new Blob([new Uint8Array(await fakeScreenshot(color))])));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/items/extract with real-shaped model answers", () => {
  it("says so when the model can't identify a product", async () => {
    answer.value = { ...BASE, recognized: false };
    expect(await extract()).toEqual({ status: 200, body: { error: "unrecognized" } });
  });

  it.each([
    ["outside the screenshot", { x: 0.5, y: 0.1, width: 0.8, height: 0.5 }],
    ["too small", { x: 0.1, y: 0.1, width: 0.02, height: 0.02 }],
    ["missing", undefined],
  ])("uses the whole screenshot when the box is %s, and flags it", async (_, productBox) => {
    answer.value = { ...BASE, productBox };
    const { body } = await extract();
    expect(body.draft.lowConfidence).toContain("image");
    expect(body.draft.rawSource).toMatchObject({ cropped: false });
    expect(body.draft.imagePaths).toHaveLength(1);
  });

  it("keeps an on-model photo as cropped, for the model to cut out next", async () => {
    answer.value = BASE;
    // A light grey photo would be framed for free if it weren't on a model.
    const { body } = await extract("#efefed");
    expect(body.draft.cutOut).toBe(true);
    const { data } = await createServerClient().storage.from(ITEM_IMAGES_BUCKET).download(body.draft.imagePaths[0]);
    // The padded crop, so a sleeve the box cut off reaches the model.
    const padded = padBox(PHOTO, SHOT.width, SHOT.height);
    expect(await sharp(Buffer.from(await data!.arrayBuffer())).metadata()).toMatchObject({
      width: padded.width,
      height: padded.height,
    });
  });

  it("lifts a flat-lay's plain light grey backdrop to white and frames it, for free", async () => {
    answer.value = { ...BASE, onModel: false };
    const { body } = await extract("#efefed");
    expect(body.draft.cutOut).toBe(false);
    const { data } = await createServerClient().storage.from(ITEM_IMAGES_BUCKET).download(body.draft.imagePaths[0]);
    const stored = sharp(Buffer.from(await data!.arrayBuffer()));
    expect(await stored.metadata()).toMatchObject({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
    expect(Math.min(...(await stored.stats()).channels.map((c) => c.min))).toBeGreaterThanOrEqual(250);
  });

  it("sends a flat-lay on a backdrop it can't whiten to the model", async () => {
    answer.value = { ...BASE, onModel: false };
    const { body } = await extract("#3f4a7a");
    expect(body.draft.cutOut).toBe(true);
  });

  it("passes web sources through to the card", async () => {
    answer.value = BASE;
    const { body } = await extract();
    expect(body.draft.webSources).toEqual(BASE.sources);
    expect(body.draft.lowConfidence).not.toContain("image");
  });

  it("starts the card from the size the model read, and keeps it in the raw source", async () => {
    answer.value = { ...BASE, size: "27 (US 4)" };
    const { body } = await extract();
    expect(body.draft.size).toBe("27 (US 4)");
    expect(body.draft.rawSource).toMatchObject({ aiSize: "27 (US 4)" });

    answer.value = BASE;
    const none = await extract();
    expect(none.body.draft.size).toBeUndefined();
    expect(none.body.draft.rawSource).toMatchObject({ aiSize: null });
  });

  it("writes the brand the way the built-in list does, and keeps the model's in the raw source", async () => {
    answer.value = { ...BASE, brand: "zara" };
    const { body } = await extract();
    expect(body.draft.brand).toBe("ZARA");
    expect(body.draft.rawSource).toMatchObject({ aiBrand: "zara" });
  });

  it("keeps a brand neither the user nor the list knows as read", async () => {
    answer.value = { ...BASE, brand: " Tiny Studio " };
    expect((await extract()).body.draft.brand).toBe("Tiny Studio");
    answer.value = BASE;
    expect((await extract()).body.draft.brand).toBeUndefined();
  });

  // Names as the stores in the demo screenshots write them.
  it.each([
    ['Speed Up High-Rise Short 4" *Updated', "lululemon", 'Speed Up High-Rise Short 4"'],
    ["Swiftly Tech Short-Sleeve Shirt 2.0 *Waist Length", "lululemon", "Swiftly Tech Short-Sleeve Shirt 2.0"],
    ["SUPIMA® LONG SLEEVE T-SHIRT", "ZARA", "Supima Long Sleeve T-Shirt"],
    ["Hollister Feel Good Oversized Hoodie", "HOLLISTER", "Feel Good Oversized Hoodie"],
    ["FAUX SUEDE BELTED JACKET", "ZARA", "Faux Suede Belted Jacket"],
  ])("cleans the name %s, and keeps the model's in the raw source", async (title, brand, clean) => {
    answer.value = { ...BASE, title, brand };
    const { body } = await extract();
    expect(body.draft.title).toBe(clean);
    expect(body.draft.rawSource).toMatchObject({ aiTitle: title });
  });

  it("writes the brand the way the user already saved it", async () => {
    const db = createServerClient();
    const { data: saved } = await db
      .from("items")
      .insert({ user_id: user.id, entry_method: "manual", title: "Align tee", category: "top", brand: "Lululemon" })
      .select("id")
      .single()
      .throwOnError();
    try {
      answer.value = { ...BASE, brand: "LULULEMON ATHLETICA" };
      expect((await extract()).body.draft.brand).toBe("Lululemon");
    } finally {
      await db.from("items").delete().eq("id", saved.id).throwOnError();
    }
  });
});
