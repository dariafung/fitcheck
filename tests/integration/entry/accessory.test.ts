import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as extractPOST } from "@/app/api/items/extract/route";
import { POST as itemsPOST } from "@/app/api/items/route";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { createServerClient } from "@/lib/db/server";
import { fakeScreenshot } from "@/lib/entry/fake-screenshot";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";
import { createTestUser, jsonRequest, removeTestUser, uploadRequest } from "./helpers";

// The mock reads every screenshot as an accessory here.
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    extractItem: vi.fn(async (...args: Parameters<typeof actual.extractItem>) => {
      const out = await actual.extractItem(...args);
      return { ...out, tags: { ...out.tags, category: "accessory" } };
    }),
  };
});

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));

const db = createServerClient();
const hoops: ItemTags = { category: "accessory", colors: [{ name: "gold" }], materials: [], formality: 3, occasions: [] };

beforeAll(async () => {
  user.id = await createTestUser();
});
afterAll(() => removeTestUser(user.id));

describe("accessories can't be added", () => {
  it("are turned away when the screenshot is read, with no photo kept", async () => {
    const res = await extractPOST(uploadRequest(new Blob([new Uint8Array(await fakeScreenshot())], { type: "image/png" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ error: "accessory" });
    const { data } = await db.storage.from(ITEM_IMAGES_BUCKET).list(user.id);
    expect(data).toEqual([]);
  });

  it("are refused on save too", async () => {
    const res = await itemsPOST(
      jsonRequest("/api/items", {
        entryMethod: "screenshot",
        title: "Gold hoops",
        imagePaths: [],
        aiTags: { ...hoops, category: "top" },
        tags: hoops,
        onModel: false,
        rawSource: {},
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "accessory" });
    const { count } = await db.from("items").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    expect(count).toBe(0);
  });
});
