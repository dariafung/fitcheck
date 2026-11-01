import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { goesWith } from "@/lib/closet/pairs";
import { createTestCloset } from "./helpers";

let closet: Awaited<ReturnType<typeof createTestCloset>>;

beforeEach(async () => {
  closet = await createTestCloset();
});

afterEach(async () => {
  await closet.cleanup();
});

async function addItem(title: string, category: string, status = "active"): Promise<string> {
  const { data } = await closet.db
    .from("items")
    .insert({ user_id: closet.userId, entry_method: "manual", title, category, status })
    .select("id")
    .single()
    .throwOnError();
  return data.id;
}

// Stored once per pair, smaller id first, as the pairing engine does.
async function pair(x: string, y: string, pairs: boolean) {
  const [a, b] = x < y ? [x, y] : [y, x];
  await closet.db
    .from("pairings")
    .insert({ user_id: closet.userId, item_a_id: a, item_b_id: b, pairs, source: "ai", prompt_version: "test" })
    .throwOnError();
}

describe("goesWith", () => {
  it("lists only cached pairs that go together, with pieces still worn", async () => {
    const jeans = await addItem("Straight jeans", "bottom");
    const shorts = await addItem("Running shorts", "bottom");
    const loafers = await addItem("Loafers", "shoes");
    const old = await addItem("Old skirt", "bottom", "passing_on");
    await pair(closet.itemId, jeans, true);
    await pair(closet.itemId, loafers, true);
    await pair(closet.itemId, shorts, false);
    await pair(closet.itemId, old, true);
    // Not about this item.
    await pair(jeans, loafers, true);

    const result = await goesWith(closet.db, closet.userId, closet.itemId);
    expect(result.count).toBe(2);
    expect(result.pieces.map((p) => p.title).sort()).toEqual(["Loafers", "Straight jeans"]);
    expect(result.pieces[0]).toMatchObject({ imageUrl: null });

    // Read from either side of the pair.
    expect((await goesWith(closet.db, closet.userId, loafers)).pieces.map((p) => p.title).sort()).toEqual([
      "Straight jeans",
      "Test linen shirt",
    ]);
  });

  it("counts every piece but only brings the first few", async () => {
    for (const title of ["A", "B", "C", "D", "E", "F"]) await pair(closet.itemId, await addItem(title, "bottom"), true);
    const result = await goesWith(closet.db, closet.userId, closet.itemId, 4);
    expect(result.count).toBe(6);
    expect(result.pieces).toHaveLength(4);
  });

  it("is empty with nothing cached, for someone else, or for a bad id", async () => {
    expect(await goesWith(closet.db, closet.userId, closet.itemId)).toEqual({ count: 0, pieces: [] });
    const jeans = await addItem("Straight jeans", "bottom");
    await pair(closet.itemId, jeans, true);
    expect(await goesWith(closet.db, randomUUID(), closet.itemId)).toEqual({ count: 0, pieces: [] });
    expect(await goesWith(closet.db, closet.userId, "not-an-id")).toEqual({ count: 0, pieces: [] });
  });
});
