import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/items/[id]/fix/route";
import * as ai from "@/lib/ai";
import { memoryBudgetStore, setBudgetStore } from "@/lib/ai/budget";
import { AiBudgetError, AiOutputError } from "@/lib/ai/errors";
import { PROMPT_VERSION } from "@/lib/ai/schemas/pick-fix-outfit";
import { complaint, ctx, fixCloset, onlyGood, request } from "./fix-helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: async () => user.id }));
// Spies on the model calls while keeping the mock answers.
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, pickFixOutfit: vi.fn(actual.pickFixOutfit), judgePairing: vi.fn(actual.judgePairing) };
});

let closet: Awaited<ReturnType<typeof fixCloset>>;
const fix = (id: string, settle = false) => POST(request("POST", `/api/items/${id}/fix${settle ? "?settle=1" : ""}`), ctx(id));
const state = async (id: string) => (await (await fix(id)).json()) as { state: string };
const asked = () => vi.mocked(ai.pickFixOutfit).mock.calls.length;
const lastInput = () => vi.mocked(ai.pickFixOutfit).mock.calls.at(-1)![0];

beforeEach(async () => {
  setBudgetStore(memoryBudgetStore());
  vi.mocked(ai.pickFixOutfit).mockClear();
  vi.mocked(ai.judgePairing).mockClear();
  closet = await fixCloset();
  user.id = closet.userId;
});
afterEach(async () => {
  await closet.cleanup();
});

describe("POST /api/items/[id]/fix", () => {
  it("shows nothing for an item that is neither rated low nor complained about, or is being passed on", async () => {
    expect(await state(closet.tee)).toEqual({ state: "none" });

    await closet.feel("tee", onlyGood());
    for (const rating of [3, 4, 5]) {
      await closet.rate("tee", rating);
      expect(await state(closet.tee)).toEqual({ state: "none" });
    }

    await closet.feel("tee", complaint());
    await closet.rate("tee", 1);
    await closet.db.from("items").update({ status: "passing_on", size: "S" }).eq("id", closet.tee).throwOnError();
    expect(await state(closet.tee)).toEqual({ state: "none" });

    expect(asked()).toBe(0);
    expect(await closet.storedFix("tee")).toBeNull();
  });

  it("answers pending while the feeling is being parsed, and keeps waiting for a piece that isn't rated low", async () => {
    // An edit: the old fields stand until the new text is parsed.
    await closet.feel("tee", complaint(), false);
    expect(await state(closet.tee)).toEqual({ state: "pending" });
    await closet.feel("tee", null, false);
    await closet.rate("tee", 4);
    expect(await state(closet.tee)).toEqual({ state: "pending" });
    // The page's last try changes nothing without a low rating.
    expect(await (await fix(closet.tee, true)).json()).toEqual({ state: "pending" });
    expect(asked()).toBe(0);
    expect(await closet.storedFix("tee")).toBeNull();
  });

  it("goes by a low rating alone once the page stops waiting for the feeling", async () => {
    // Old fields with a complaint, and a new text that never got parsed.
    await closet.feel("tee", complaint(), false);
    await closet.rate("tee", 2);
    expect(await state(closet.tee)).toEqual({ state: "pending" });
    expect(asked()).toBe(0);

    const settled = await (await fix(closet.tee, true)).json();
    expect(settled).toMatchObject({ state: "suggestion", reason: "Mock: the Test dark jeans shows it at its best." });
    // Rated low, reason unknown: the unparsed note's old complaint isn't sent.
    expect(lastInput()).toMatchObject({ complaints: [], lowRating: true });

    // Stored: the next opening shows it at once, with no waiting and no call.
    expect(await (await fix(closet.tee)).json()).toEqual(settled);
    expect(asked()).toBe(1);

    // The feeling parses with a complaint: asked again, now about that.
    await closet.feel("tee", complaint("too see-through"));
    expect((await state(closet.tee)).state).toBe("suggestion");
    expect(asked()).toBe(2);
    expect(lastInput().complaints).toEqual([{ aspect: "color", said: "too see-through", means: "too see-through" }]);
  });

  it("suggests one complete outfit of the user's own pieces for a complaint, and stores it", async () => {
    await closet.feel("tee", complaint());
    await closet.photograph("tee");
    const res = await fix(closet.tee);
    expect(res.status).toBe(200);
    const body = await res.json();
    // The mock picks the first complete outfit around the piece.
    const outfit = [closet.tee, closet.jeans, closet.sneakers].sort();
    expect(body).toMatchObject({ state: "suggestion", savedId: null, outfit: { itemIds: outfit } });
    expect(body.reason).toBe("Mock: the Test dark jeans takes care of it.");
    expect(body.outfit.pieces.map((p: { category: string }) => p.category)).toEqual(["top", "bottom", "shoes"]);
    expect(await closet.storedFix("tee")).toMatchObject({ prompt_version: PROMPT_VERSION, outfit_item_ids: outfit, reason: body.reason });

    const input = lastInput();
    expect(input.complaints).toEqual([{ aspect: "color", said: "washes me out", means: "washes me out" }]);
    expect(input.lowRating).toBe(false);
    // The piece goes with its own photo, shrunk; the others as text.
    expect(input.item).toMatchObject({ id: closet.tee, photo: { kind: "inline", mime: "image/webp" } });
    expect(input.closet.map((i) => i.id)).toEqual([closet.jeans, closet.sneakers, closet.blazer]);
    for (const other of input.closet) expect(other).not.toHaveProperty("photo");
  });

  it("suggests an outfit for a piece rated 1 or 2 with nothing bad written about it", async () => {
    await closet.feel("tee", onlyGood());
    await closet.rate("tee", 2);
    const body = await (await fix(closet.tee)).json();
    expect(body).toMatchObject({ state: "suggestion", reason: "Mock: the Test dark jeans shows it at its best." });
    expect(lastInput()).toMatchObject({ complaints: [], lowRating: true });
    // No photo on file: the piece goes as text.
    expect(lastInput().item).not.toHaveProperty("photo");
  });

  it("lists only active items that can share an outfit with the piece and a temperature with it", async () => {
    await closet.feel("tee", complaint());
    await closet.add("Test second top", "top");
    await closet.add("Test dress", "one_piece");
    await closet.add("Test scarf", "accessory");
    await closet.add("Test ski pants", "bottom", { min: 0, max: 30 });
    const skirt = await closet.add("Test skirt", "bottom", { min: 60, max: 90 });
    const boots = await closet.add("Test boots", "shoes");
    await closet.db.from("items").update({ status: "passing_on", size: "8" }).eq("id", boots).throwOnError();
    await fix(closet.tee);
    const listed = lastInput().closet.map((i) => i.id);
    expect(listed).toEqual([...[closet.jeans, skirt].sort(), closet.sneakers, closet.blazer]);
  });

  it("doesn't ask the model again while nothing changed", async () => {
    await closet.feel("tee", complaint());
    const first = await (await fix(closet.tee)).json();
    expect(await (await fix(closet.tee)).json()).toEqual(first);
    expect(asked()).toBe(1);
  });

  it("asks again when the rating turns low, not when it moves within low or back", async () => {
    await closet.rate("tee", 4);
    expect(await state(closet.tee)).toEqual({ state: "none" });
    expect(asked()).toBe(0);

    await closet.rate("tee", 2);
    expect((await state(closet.tee)).state).toBe("suggestion");
    expect(asked()).toBe(1);
    const stored = await closet.storedFix("tee");

    await closet.rate("tee", 1);
    expect((await state(closet.tee)).state).toBe("suggestion");
    expect(asked()).toBe(1);

    // No longer low: nothing shows; low again: the stored one is still right.
    await closet.rate("tee", null);
    expect(await state(closet.tee)).toEqual({ state: "none" });
    await closet.rate("tee", 2);
    expect((await state(closet.tee)).state).toBe("suggestion");
    expect(asked()).toBe(1);
    expect(await closet.storedFix("tee")).toEqual(stored);
  });

  it("asks again when a low rating joins a complaint, the complaint changes, or the closet to choose from does", async () => {
    await closet.feel("tee", complaint());
    await fix(closet.tee);
    const hashes = [(await closet.storedFix("tee"))?.input_hash];

    const changes = [
      () => closet.rate("tee", 1),
      () => closet.feel("tee", complaint("too see-through")),
      () => closet.add("Test loafers", "shoes"),
      () => closet.db.from("items").update({ user_tags: { formality: 4 } }).eq("id", closet.jeans).throwOnError(),
      () => closet.db.from("items").delete().eq("id", closet.blazer).throwOnError(),
    ];
    for (const [i, change] of changes.entries()) {
      await change();
      await fix(closet.tee);
      expect(asked()).toBe(i + 2);
      hashes.push((await closet.storedFix("tee"))?.input_hash);
    }
    expect(new Set(hashes).size).toBe(hashes.length);

    // An item it can't be worn with doesn't count.
    await closet.add("Test other top", "top");
    await fix(closet.tee);
    expect(asked()).toBe(changes.length + 1);
  });

  it("skips the model and says so in one fixed line when the closet can't complete an outfit", async () => {
    await closet.feel("tee", complaint());
    await closet.db.from("items").delete().eq("id", closet.sneakers).throwOnError();
    expect(await state(closet.tee)).toEqual({ state: "no_fix" });
    expect(asked()).toBe(0);
    expect(await closet.storedFix("tee")).toBeNull();
  });

  it("never touches pairings", async () => {
    await closet.feel("tee", complaint());
    expect((await state(closet.tee)).state).toBe("suggestion");
    expect(ai.judgePairing).not.toHaveBeenCalled();
    const { count } = await closet.db.from("pairings").select("id", { count: "exact", head: true }).eq("user_id", closet.userId).throwOnError();
    expect(count).toBe(0);
  });

  it("keeps the answer that nothing helps", async () => {
    // The mock gives no pick when every complaint is of the "other" kind.
    await closet.feel("tee", complaint("the tag scratches", "other"));
    expect(await state(closet.tee)).toEqual({ state: "no_fix" });
    expect(await closet.storedFix("tee")).toMatchObject({ outfit_item_ids: null, reason: null });
    expect(await state(closet.tee)).toEqual({ state: "no_fix" });
    expect(asked()).toBe(1);
  });

  it("drops a pick that isn't a complete outfit of listed items", async () => {
    const dress = await closet.add("Test dress", "one_piece");
    const boots = await closet.add("Test boots", "shoes");
    const picks: string[][] = [
      // A slot missing, a slot filled twice.
      [closet.jeans],
      [closet.jeans, closet.blazer],
      [closet.jeans, closet.sneakers, boots],
      // Not in the list: unknown, the piece itself, a dress with a top.
      [closet.jeans, closet.sneakers, randomUUID()],
      [closet.tee, closet.jeans, closet.sneakers],
      [dress, closet.sneakers],
    ];
    for (const [i, itemIds] of picks.entries()) {
      // A new complaint each time, so the model is asked again.
      await closet.feel("tee", complaint(`complaint ${i}`));
      vi.mocked(ai.pickFixOutfit).mockResolvedValueOnce({ itemIds, reason: "Wear it like this." });
      expect(await state(closet.tee), JSON.stringify(itemIds)).toEqual({ state: "no_fix" });
      expect(await closet.storedFix("tee")).toMatchObject({ outfit_item_ids: null, reason: null });
    }
    expect(asked()).toBe(picks.length);
  });

  it("accepts any complete outfit the model picks from the list", async () => {
    await closet.feel("tee", complaint());
    vi.mocked(ai.pickFixOutfit).mockResolvedValueOnce({
      itemIds: [closet.blazer, closet.sneakers, closet.jeans],
      reason: "The black blazer frames the beige.",
    });
    const body = await (await fix(closet.tee)).json();
    expect(body).toMatchObject({
      state: "suggestion",
      reason: "The black blazer frames the beige.",
      outfit: { itemIds: [closet.tee, closet.jeans, closet.sneakers, closet.blazer].sort() },
    });
  });

  it("shows nothing, with no error, when the model fails or the budget is spent", async () => {
    // The skip is logged on the server; the page is told nothing.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await closet.feel("tee", complaint());
    vi.mocked(ai.pickFixOutfit).mockRejectedValueOnce(new AiOutputError("pickFixOutfit", []));
    const failed = await fix(closet.tee);
    expect(failed.status).toBe(200);
    expect(await failed.json()).toEqual({ state: "none" });

    vi.mocked(ai.pickFixOutfit).mockRejectedValueOnce(new AiBudgetError("pickFixOutfit"));
    expect(await state(closet.tee)).toEqual({ state: "none" });
    expect(await closet.storedFix("tee")).toBeNull();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("pickFixOutfit skipped"));
  });

  it("keeps the stored suggestion when a new one can't be made", async () => {
    // The skip is logged on the server; the page is told nothing.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await closet.feel("tee", complaint());
    const first = await (await fix(closet.tee)).json();
    const before = await closet.storedFix("tee");

    await closet.feel("tee", complaint("too see-through"));
    vi.mocked(ai.pickFixOutfit).mockRejectedValueOnce(new AiOutputError("pickFixOutfit", []));
    expect(await (await fix(closet.tee)).json()).toEqual(first);
    expect(await closet.storedFix("tee")).toEqual(before);

    // Unless one of its pieces has left the closet since.
    await closet.add("Test spare jeans", "bottom");
    await closet.db.from("items").delete().eq("id", closet.jeans).throwOnError();
    vi.mocked(ai.pickFixOutfit).mockRejectedValueOnce(new AiOutputError("pickFixOutfit", []));
    expect(await state(closet.tee)).toEqual({ state: "none" });
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("pickFixOutfit skipped"));
  });

  it("answers 404 for someone else's item or a bad id", async () => {
    expect((await fix(randomUUID())).status).toBe(404);
    expect((await fix("not-an-id")).status).toBe(404);
    const other = await fixCloset();
    try {
      expect((await fix(other.tee)).status).toBe(404);
    } finally {
      await other.cleanup();
    }
  });
});
