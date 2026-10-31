import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/items/route";
import type { ItemTags } from "@/lib/ai";
import { effectiveTags } from "@/lib/db/items";
import { createServerClient } from "@/lib/db/server";
import type { SaveItemRequest } from "@/lib/entry/draft";
import { createTestUser, jsonRequest, removeTestUser } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));

beforeAll(async () => {
  user.id = await createTestUser();
});
afterAll(() => removeTestUser(user.id));

const aiTags: ItemTags = {
  category: "top",
  colors: [{ name: "Sage" }],
  materials: ["linen"],
  formality: 2,
  tempRangeF: { min: 55, max: 85 },
  occasions: ["social"],
};

function request(overrides: Partial<SaveItemRequest> = {}): SaveItemRequest {
  return {
    entryMethod: "screenshot",
    title: "Linen Boxy Tee",
    brand: "Fieldnote Supply",
    priceCents: 5800,
    currency: "USD",
    imagePaths: [`${user.id}/${randomUUID()}.webp`],
    aiTags,
    tags: { ...aiTags, category: "outerwear", fit: "relaxed" },
    onModel: false,
    rawSource: { cropped: true },
    ...overrides,
  };
}

describe("POST /api/items", () => {
  it("saves the item with AI tags and only the user's changes", async () => {
    const res = await POST(jsonRequest("/api/items", request()));
    expect(res.status).toBe(201);
    const { item } = await res.json();
    expect(item).toMatchObject({ title: "Linen Boxy Tee", category: "outerwear" });

    const { data: row } = await createServerClient()
      .from("items")
      .select("*")
      .eq("id", item.id)
      .single()
      .throwOnError();
    expect(row).toMatchObject({
      user_id: user.id,
      status: "active",
      entry_method: "screenshot",
      price_cents: 5800,
      currency: "USD",
      ai_tags: aiTags,
      user_tags: { category: "outerwear", fit: "relaxed" },
      on_model: false,
    });
    expect(row.image_paths).toHaveLength(1);
    expect(effectiveTags(row.ai_tags as ItemTags, row.user_tags as Partial<ItemTags>)).toMatchObject({
      category: "outerwear",
      fit: "relaxed",
      materials: ["linen"],
    });
  });

  it("keeps a typed size as typed, and none when left blank", async () => {
    const sized = await (await POST(jsonRequest("/api/items", request({ size: "  US 8 " })))).json();
    const blank = await (await POST(jsonRequest("/api/items", request({ size: "" })))).json();
    const { data } = await createServerClient()
      .from("items")
      .select("id, size")
      .in("id", [sized.item.id, blank.item.id])
      .throwOnError();
    expect(Object.fromEntries(data.map((r) => [r.id, r.size]))).toEqual({
      [sized.item.id]: "US 8",
      [blank.item.id]: null,
    });
    expect((await POST(jsonRequest("/api/items", request({ size: "x".repeat(21) })))).status).toBe(400);
  });

  it("refuses image paths outside the user's folder", async () => {
    const res = await POST(
      jsonRequest("/api/items", request({ imagePaths: [`${randomUUID()}/${randomUUID()}.webp`] })),
    );
    expect(res.status).toBe(400);
  });

  it("refuses an item without a photo", async () => {
    const res = await POST(jsonRequest("/api/items", request({ title: "No photo tee", imagePaths: [] })));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_item" });
    const { count } = await createServerClient()
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("title", "No photo tee");
    expect(count).toBe(0);
  });

  it("refuses an invalid item", async () => {
    const res = await POST(jsonRequest("/api/items", { ...request(), title: " " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_item" });
  });
});
