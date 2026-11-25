import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/api/items/[id]/route";
import { createTestCloset } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: async () => user.id }));

let closet: Awaited<ReturnType<typeof createTestCloset>>;
const ctx = () => ({ params: Promise.resolve({ id: closet.itemId }) });
const patch = (body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/items/${closet.itemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(),
  );
async function row() {
  const { data } = await closet.db.from("items").select("size_fit, updated_at").eq("id", closet.itemId).single().throwOnError();
  return data;
}

beforeEach(async () => {
  closet = await createTestCloset();
  user.id = closet.userId;
});
afterEach(async () => {
  await closet.cleanup();
});

describe("PATCH /api/items/[id] sizeFit", () => {
  it("saves and clears without touching updated_at", async () => {
    const before = await row();
    const res = await patch({ sizeFit: "small" });
    expect(res.status).toBe(200);
    expect((await res.json()).item.sizeFit).toBe("small");
    expect(await row()).toEqual({ size_fit: "small", updated_at: before.updated_at });
    await patch({ sizeFit: null });
    const got = await GET(new Request(`http://localhost/api/items/${closet.itemId}`), ctx());
    expect((await got.json()).item.sizeFit).toBeNull();
  });

  it("turns away other answers", async () => {
    expect((await patch({ sizeFit: "tight" })).status).toBe(400);
  });
});
