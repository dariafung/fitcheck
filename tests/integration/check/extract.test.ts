import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/checks/extract/route";
import { createServerClient } from "@/lib/db/server";
import type { ItemDraft } from "@/lib/entry/draft";
import { fakeScreenshot } from "@/lib/entry/fake-screenshot";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";
import { createTestUser, removeTestUser, uploadRequest } from "../entry/helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));
// The mock's answer, with a store's name and brand when a test sets them.
const named = vi.hoisted(() => ({ title: undefined as string | undefined, brand: undefined as string | undefined }));
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    extractItem: async (...args: Parameters<typeof actual.extractItem>) => {
      const out = await actual.extractItem(...args);
      return named.title ? { ...out, title: named.title, brand: named.brand } : out;
    },
  };
});

beforeAll(async () => {
  user.id = await createTestUser();
});
afterAll(() => removeTestUser(user.id));

describe("POST /api/checks/extract", () => {
  it("returns a draft with the photo inline and stores nothing", async () => {
    const shot = new Blob([new Uint8Array(await fakeScreenshot())], { type: "image/png" });
    const res = await POST(uploadRequest(shot));
    expect(res.status).toBe(200);
    const draft = (await res.json()).draft as ItemDraft;
    expect(draft).toMatchObject({ title: "Mock item", brand: "lululemon", tags: { category: "top" }, imagePaths: [], rawSource: {} });
    expect(draft.imageUrls).toEqual([expect.stringMatching(/^data:image\/webp;base64,/)]);
    expect(draft.lowConfidence).not.toContain("image");

    const { data } = await createServerClient().storage.from(ITEM_IMAGES_BUCKET).list(user.id);
    expect(data).toEqual([]);
  });

  it("cleans the name the same way as entry", async () => {
    Object.assign(named, { title: "Hollister Feel Good Oversized Hoodie *Updated", brand: "HOLLISTER" });
    try {
      const shot = new Blob([new Uint8Array(await fakeScreenshot())], { type: "image/png" });
      const draft = (await (await POST(uploadRequest(shot))).json()).draft as ItemDraft;
      expect(draft).toMatchObject({ title: "Feel Good Oversized Hoodie", brand: "HOLLISTER" });
    } finally {
      Object.assign(named, { title: undefined, brand: undefined });
    }
  });

  it("answers an unusable upload with 200 and an error code", async () => {
    const res = await POST(uploadRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ error: "no_file" });
  });
});
