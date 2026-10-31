import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/style-profile/route";
import * as ai from "@/lib/ai";
import { memoryBudgetStore, setBudgetStore } from "@/lib/ai/budget";
import { AiBudgetError, AiOutputError } from "@/lib/ai/errors";
import { PROMPT_VERSION } from "@/lib/ai/schemas/build-profile";
import type { FeelingStructured } from "@/lib/ai/schemas/common";
import { saveFeeling, storeParsedFeeling } from "@/lib/closet/feelings";
import { loadStyleCardState } from "@/lib/closet/style-profile";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import { createServerClient } from "@/lib/db/server";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: async () => user.id }));
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, buildProfile: vi.fn(actual.buildProfile) };
});

const db = createServerClient();
let itemIds: string[] = [];
let feelingIds: string[] = [];

const ITEMS = [
  { title: "Test white shirt", category: "top", colors: ["white"], materials: ["cotton"], occasions: ["school"] },
  { title: "Test dark jeans", category: "bottom", colors: ["indigo"], materials: ["denim"], occasions: ["school"] },
  { title: "Test gray tee", category: "top", colors: ["gray"], materials: ["cotton"], occasions: ["sport"] },
  { title: "Test black boots", category: "shoes", colors: ["black"], materials: ["leather"], occasions: ["social"] },
] as const;

const feeling = (overrides: Partial<FeelingStructured> = {}): FeelingStructured => ({
  flattering: "yes",
  liked: "yes",
  aspects: [{ aspect: "color", sentiment: "positive", said: "looks bright", means: "light colors suit you" }],
  occasions: [],
  mood: [],
  summary: "Looks bright.",
  ...overrides,
});

// A throwaway user with four items; the first `felt` have parsed feelings.
async function closet(felt = 3) {
  user.id = randomUUID();
  await db.from("users").insert({ id: user.id, display_name: "Style test user" }).throwOnError();
  const { data: items } = await db
    .from("items")
    .insert(
      ITEMS.map((i) => ({
        user_id: user.id,
        entry_method: "manual",
        title: i.title,
        category: i.category,
        ai_tags: {
          category: i.category,
          colors: i.colors.map((name) => ({ name })),
          materials: [...i.materials],
          formality: 2,
          occasions: [...i.occasions],
        },
      })),
    )
    .select("id")
    .throwOnError();
  itemIds = items.map((i) => i.id);
  const { data: feelings } = await db
    .from("item_feelings")
    .insert(
      itemIds.slice(0, felt).map((itemId) => ({
        item_id: itemId,
        user_id: user.id,
        raw_text: "Looks bright.",
        source: "typed",
        structured: feeling(),
        parsed_at: new Date().toISOString(),
      })),
    )
    .select("id")
    .throwOnError();
  feelingIds = feelings.map((f) => f.id);
}

async function stored() {
  const { data } = await db
    .from("style_profiles")
    .select("headline, suits, avoid, input_hash, prompt_version, generated_at, generating_since, generating_token")
    .eq("user_id", user.id)
    .maybeSingle()
    .throwOnError();
  return data;
}

// Lets the next regeneration through the one-minute cooldown.
async function pastCooldown() {
  await db
    .from("style_profiles")
    .update({ generating_since: new Date(Date.now() - 90_000).toISOString() })
    .eq("user_id", user.id)
    .throwOnError();
}

async function parse(index: number, structured: FeelingStructured, text = "Looks bright.") {
  await storeParsedFeeling(db, { feelingId: feelingIds[index], text, structured });
}

beforeEach(async () => {
  setBudgetStore(memoryBudgetStore());
  vi.mocked(ai.buildProfile).mockClear();
});

afterEach(async () => {
  if (user.id && user.id !== DEMO_USER_ID) await db.from("users").delete().eq("id", user.id).throwOnError();
});

describe("POST /api/style-profile", () => {
  it("builds the card from active items and parsed feelings and stores it", async () => {
    await closet();
    const res = await POST();
    expect(res.status).toBe(200);
    const { card } = await res.json();
    expect(card.headline).toBeTruthy();
    expect(card.rows.length).toBeGreaterThanOrEqual(3);

    const row = await stored();
    expect(row).toMatchObject({ prompt_version: PROMPT_VERSION, generating_token: null });
    expect(row?.input_hash).toBeTruthy();
    const cited = [row?.headline, ...(row?.suits as unknown[]), ...(row?.avoid as unknown[])].flatMap(
      (s) => (s as { evidenceItemIds: string[] }).evidenceItemIds,
    );
    for (const id of cited) expect(itemIds).toContain(id);
    expect((await loadStyleCardState(db, user.id)).stale).toBe(false);
  });

  it("doesn't call the model again while the closet is unchanged", async () => {
    await closet();
    const first = await (await POST()).json();
    const again = await POST();
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(first);
    expect(ai.buildProfile).toHaveBeenCalledTimes(1);
  });

  it("waits out a feeling that is still being parsed, then rebuilds once", async () => {
    await closet();
    await POST();
    await pastCooldown();

    // Saved but not parsed yet: the old structured fields still stand.
    await saveFeeling(db, { itemId: itemIds[0], userId: user.id, text: "Changed my mind." });
    expect((await loadStyleCardState(db, user.id)).stale).toBe(false);
    await POST();
    expect(ai.buildProfile).toHaveBeenCalledTimes(1);

    const changed = feeling({ liked: "no", aspects: [{ aspect: "fit", sentiment: "negative", said: "too tight", means: "needs room" }] });
    await parse(0, changed, "Changed my mind.");
    expect((await loadStyleCardState(db, user.id)).stale).toBe(true);
    expect((await POST()).status).toBe(200);
    expect(ai.buildProfile).toHaveBeenCalledTimes(2);
  });

  it("lets only one of two requests at once rebuild the card", async () => {
    await closet();
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const actual = vi.mocked(ai.buildProfile).getMockImplementation()!;
    vi.mocked(ai.buildProfile).mockImplementationOnce(async (input) => {
      await gate;
      return actual(input);
    });

    const first = POST();
    // Let the first request take the lock before the second asks.
    await vi.waitFor(() => expect(ai.buildProfile).toHaveBeenCalledTimes(1));
    const second = await POST();
    release();
    expect(second.status).toBe(202);
    expect((await first).status).toBe(200);
    expect(ai.buildProfile).toHaveBeenCalledTimes(1);
  });

  it("takes over a rebuild that never finished, and the old one can't write", async () => {
    await closet();
    const oldToken = randomUUID();
    await db
      .from("style_profiles")
      .insert({ user_id: user.id, generating_token: oldToken, generating_since: new Date(Date.now() - 180_000).toISOString() })
      .throwOnError();

    expect((await POST()).status).toBe(200);
    const { data: late } = await db
      .from("style_profiles")
      .update({ input_hash: "late" })
      .eq("user_id", user.id)
      .eq("generating_token", oldToken)
      .select("id")
      .throwOnError();
    expect(late).toEqual([]);
    expect((await stored())?.input_hash).not.toBe("late");
  });

  it("keeps the old card when the model fails, and waits out the cooldown", async () => {
    await closet();
    await POST();
    const before = await stored();
    await pastCooldown();
    await parse(1, feeling({ flattering: "no" }));

    vi.mocked(ai.buildProfile).mockRejectedValueOnce(new AiOutputError("buildProfile", []));
    expect((await POST()).status).toBe(502);
    const after = await stored();
    expect(after).toMatchObject({ input_hash: before?.input_hash, suits: before?.suits, generating_token: null });

    // Tried less than a minute ago: no new attempt yet.
    expect((await POST()).status).toBe(202);
    expect(ai.buildProfile).toHaveBeenCalledTimes(2);
  });

  it("answers the budget error when the day's AI budget is spent", async () => {
    await closet();
    vi.mocked(ai.buildProfile).mockRejectedValueOnce(new AiBudgetError("buildProfile"));
    const res = await POST();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("AiBudgetError");
    expect((await stored())?.input_hash).toBeNull();
  });

  it("needs three parsed feelings", async () => {
    await closet(2);
    const res = await POST();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "NotEnoughFeelings" });
    expect(ai.buildProfile).not.toHaveBeenCalled();
  });

  it("leaves items that are passing on out", async () => {
    await closet();
    await POST();
    // The boots have no feeling, but leaving the closet still changes it.
    await db.from("items").update({ status: "passing_on" }).eq("id", itemIds[3]).throwOnError();
    expect((await loadStyleCardState(db, user.id)).stale).toBe(true);
    // Two parsed feelings left on active items: too few for a card.
    await db.from("items").update({ status: "passing_on" }).eq("id", itemIds[0]).throwOnError();
    expect((await loadStyleCardState(db, user.id)).enough).toBe(false);
  });

  it("never rebuilds the persona's seed card", async () => {
    user.id = DEMO_USER_ID;
    const res = await POST();
    expect(res.status).toBe(403);
    expect(ai.buildProfile).not.toHaveBeenCalled();
  });
});
