import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/items/[id]/feelings/route";
import { createTestCloset } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));

// Collect after() callbacks so the test can run them once the response is back.
const pending = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
  after: (task: () => Promise<void>) => pending.push(task),
}));

async function flushAfter() {
  while (pending.length > 0) await pending.shift()!();
}

let closet: Awaited<ReturnType<typeof createTestCloset>>;

beforeEach(async () => {
  closet = await createTestCloset();
  user.id = closet.userId;
  pending.length = 0;
});

afterEach(async () => {
  await closet.cleanup();
});

function post(id: string, body: unknown) {
  return POST(
    new Request(`http://test/api/items/${id}/feelings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

async function feelings() {
  const { data } = await closet.db
    .from("item_feelings")
    .select("raw_text, source, structured, parsed_at")
    .eq("item_id", closet.itemId)
    .throwOnError();
  return data;
}

describe("POST /api/items/[id]/feelings", () => {
  it("saves the raw text first, then fills structured fields in the background", async () => {
    const res = await post(closet.itemId, { text: "  Love it, so flattering.  " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ feeling: { text: "Love it, so flattering." } });

    const [before] = await feelings();
    expect(before).toMatchObject({ raw_text: "Love it, so flattering.", source: "typed", structured: null });

    await flushAfter();
    const [after] = await feelings();
    expect(after.structured).toMatchObject({ flattering: "yes", liked: "yes", occasions: ["social"] });
    expect(after.parsed_at).not.toBeNull();
  });

  it("edits the same feeling and merges the new fields into the old ones", async () => {
    await post(closet.itemId, { text: "Love it." });
    await flushAfter();
    await post(closet.itemId, { text: "Wore it to brunch." });

    const rows = await feelings();
    expect(rows).toHaveLength(1);
    // Old fields stay while the new text is being parsed.
    expect(rows[0]).toMatchObject({
      raw_text: "Wore it to brunch.",
      structured: { liked: "yes" },
      parsed_at: null,
    });

    await flushAfter();
    const [merged] = await feelings();
    // The new text says nothing about liking it, so the old answer stays.
    expect(merged.structured).toMatchObject({
      flattering: "yes",
      liked: "yes",
      summary: "Wore it to brunch.",
    });
    expect(merged.parsed_at).not.toBeNull();

    await post(closet.itemId, { text: "Too tight now, I hate it." });
    await flushAfter();
    expect((await feelings())[0].structured).toMatchObject({
      flattering: "no",
      liked: "no",
      aspects: [{ aspect: "fit", sentiment: "negative", said: "tight", means: "tight" }],
    });
  });

  it("does not let a stale parse overwrite a newer edit", async () => {
    await post(closet.itemId, { text: "Love it." });
    const staleParse = pending.shift()!;
    await post(closet.itemId, { text: "Itchy." });
    await staleParse();

    const [row] = await feelings();
    expect(row).toMatchObject({ raw_text: "Itchy.", structured: null });
    await flushAfter();
    expect((await feelings())[0].structured).toMatchObject({ flattering: "no" });
  });

  it("never touches the tags the user set by hand", async () => {
    await post(closet.itemId, { text: "Love it for work, so flattering." });
    await flushAfter();
    const { data } = await closet.db
      .from("items")
      .select("user_tags")
      .eq("id", closet.itemId)
      .single()
      .throwOnError();
    expect(data.user_tags).toEqual({ fit: "oversized" });
  });

  it("records whether the latest save came from a recording", async () => {
    await post(closet.itemId, { text: "Love the color.", source: "voice" });
    expect((await feelings())[0]).toMatchObject({ source: "voice" });
    await post(closet.itemId, { text: "Love the color. Itchy though." });
    expect((await feelings())[0]).toMatchObject({ source: "typed" });
    expect((await post(closet.itemId, { text: "Nice.", source: "video" })).status).toBe(400);
    await flushAfter();
  });

  it("rejects blank text and unknown items without writing", async () => {
    expect((await post(closet.itemId, { text: "   " })).status).toBe(400);
    expect((await post(closet.itemId, {})).status).toBe(400);
    expect((await post(randomUUID(), { text: "Nice." })).status).toBe(404);
    expect(await feelings()).toEqual([]);
    expect(pending).toEqual([]);
  });
});
