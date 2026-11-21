import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as extractPOST } from "@/app/api/checks/extract/route";
import { POST as photoPOST } from "@/app/api/checks/photo/route";
import { POST as itemsPOST } from "@/app/api/items/route";
import type { ItemTags } from "@/lib/ai";
import { DEMO_READ_ONLY_ERROR } from "@/lib/auth/messages";
import { createServerClient } from "@/lib/db/server";
import type { ItemDraft } from "@/lib/entry/draft";
import { fakeScreenshot } from "@/lib/entry/fake-screenshot";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/entry/frame";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";
import { createTestUser, jsonRequest, removeTestUser, uploadRequest } from "../entry/helpers";

// "I bought it" on a check result: the photo is stored here, then the item
// goes through POST /api/items like any other.
const user = vi.hoisted(() => ({ id: "", readOnly: false }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));
vi.mock("@/lib/auth/session", () => ({ isReadOnly: async () => user.readOnly, sessionUser: async () => null }));

beforeAll(async () => {
  user.id = await createTestUser();
});
afterAll(() => removeTestUser(user.id));

const tags: ItemTags = { category: "top", colors: [{ name: "blue" }], materials: [], formality: 2, occasions: ["social"] };

async function photo(): Promise<string> {
  const webp = await sharp({ create: { width: 90, height: 120, channels: 3, background: "#36c" } }).webp().toBuffer();
  return `data:image/webp;base64,${webp.toString("base64")}`;
}

async function storedFiles(): Promise<string[]> {
  const { data } = await createServerClient().storage.from(ITEM_IMAGES_BUCKET).list(user.id);
  return (data ?? []).map((f) => f.name);
}

describe("POST /api/checks/photo", () => {
  it("stores the checked photo as it came, ready for POST /api/items", async () => {
    const res = await photoPOST(jsonRequest("/api/checks/photo", { photo: await photo() }));
    expect(res.status).toBe(201);
    const { path } = await res.json();
    expect(path).toMatch(new RegExp(`^${user.id}/[0-9a-f-]{36}\\.webp$`));

    // The page's photo is framed already; storing it doesn't frame it again.
    const db = createServerClient();
    const { data } = await db.storage.from(ITEM_IMAGES_BUCKET).download(path);
    const meta = await sharp(Buffer.from(await data!.arrayBuffer())).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 90, height: 120 });

    const saved = await itemsPOST(
      jsonRequest("/api/items", {
        entryMethod: "screenshot",
        title: "Blue tee",
        imagePaths: [path],
        aiTags: tags,
        tags,
        onModel: false,
        rawSource: { fromCheck: true },
      }),
    );
    expect(saved.status).toBe(201);
    const { item } = await saved.json();
    const { data: row } = await db.from("items").select("user_id, image_paths, status").eq("id", item.id).single().throwOnError();
    expect(row).toEqual({ user_id: user.id, image_paths: [path], status: "active" });
  });

  it("keeps the frame the check's own extract step gave the photo", async () => {
    const before = await storedFiles();
    const shot = new Blob([new Uint8Array(await fakeScreenshot())], { type: "image/png" });
    const draft = (await (await extractPOST(uploadRequest(shot))).json()).draft as ItemDraft;
    // The check on its own stores nothing.
    expect(await storedFiles()).toEqual(before);

    const res = await photoPOST(jsonRequest("/api/checks/photo", { photo: draft.imageUrls[0] }));
    expect(res.status).toBe(201);
    const { path } = await res.json();
    const { data } = await createServerClient().storage.from(ITEM_IMAGES_BUCKET).download(path);
    const meta = await sharp(Buffer.from(await data!.arrayBuffer())).metadata();
    expect(meta).toMatchObject({ format: "webp", width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  });

  it("rejects anything that isn't a picture", async () => {
    const before = await storedFiles();
    const junk = `data:image/png;base64,${Buffer.from("hello").toString("base64")}`;
    expect((await photoPOST(jsonRequest("/api/checks/photo", { photo: junk }))).status).toBe(400);
    expect((await photoPOST(jsonRequest("/api/checks/photo", { photo: "https://example.com/a.png" }))).status).toBe(400);
    expect((await photoPOST(jsonRequest("/api/checks/photo", {}))).status).toBe(400);
    expect(await storedFiles()).toEqual(before);
  });

  it("turns the read-only demo account away before storing anything", async () => {
    const before = await storedFiles();
    user.readOnly = true;
    try {
      const res = await photoPOST(jsonRequest("/api/checks/photo", { photo: await photo() }));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe(DEMO_READ_ONLY_ERROR);
      expect(await storedFiles()).toEqual(before);
    } finally {
      user.readOnly = false;
    }
  });
});
