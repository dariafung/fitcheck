import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/pairings/route";
import * as ai from "@/lib/ai";
import { PROMPT_VERSION } from "@/lib/ai/schemas/judge-pairing";
import { SAMPLE_CLOSET } from "@/lib/check/fixtures";
import {
  CANDIDATE_ITEM_ID,
  computeClosetOutfits,
  type ClosetOutfits,
} from "@/lib/check/pairings";
import type { JudgeFn } from "@/lib/check/judge";
import { pairKey } from "@/lib/check/types";
import { createServerClient } from "@/lib/db/server";

// Counts model calls while keeping the mock answers.
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, judgePairing: vi.fn(actual.judgePairing) };
});
const judgeCalls = () => vi.mocked(ai.judgePairing).mock.calls.length;

// The route reads the user from the server; point it at this file's user.
const current = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => current.userId }));

// Rows use random ids and are removed afterwards; the local database is
// shared by every lane. Deleting the user cascades to items and pairings.
const db = createServerClient();
const userId = randomUUID();
current.userId = userId;
const idMap = new Map(SAMPLE_CLOSET.map((item) => [item.id, randomUUID()]));
const realId = (fixtureId: string) => idMap.get(fixtureId)!;
const byTitle = (title: string) => realId(SAMPLE_CLOSET.find((i) => i.title === title)!.id);

async function outfits(): Promise<ClosetOutfits> {
  const res = await POST();
  expect(res.status).toBe(200);
  return res.json();
}

beforeAll(async () => {
  await db.from("users").insert({ id: userId, display_name: "Pairing test" }).throwOnError();
  await db
    .from("items")
    .insert(
      SAMPLE_CLOSET.map((item) => ({
        id: realId(item.id),
        user_id: userId,
        entry_method: "manual",
        title: item.title,
        category: item.tags.category,
        ai_tags: item.tags,
      })),
    )
    .throwOnError();
});

afterAll(async () => {
  await db.from("users").delete().eq("id", userId).throwOnError();
});

beforeEach(async () => {
  vi.mocked(ai.judgePairing).mockClear();
  await db.from("pairings").delete().eq("user_id", userId).throwOnError();
});

describe("POST /api/pairings", () => {
  it("answers 404 when the current user doesn't exist", async () => {
    current.userId = randomUUID();
    try {
      expect((await POST()).status).toBe(404);
    } finally {
      current.userId = userId;
    }
  });

  it("judges needed pairs once, caches them, and enumerates outfits", async () => {
    const first = await outfits();
    expect(first.stats.judged).toBe(first.stats.neededPairs);
    expect(first.stats.cached).toBe(0);
    expect(first.stats.judgeCalls).toBe(judgeCalls());
    expect(first.summary.total).toBeGreaterThan(0);
    expect(first.outfits).toHaveLength(first.summary.total);

    const { data: rows } = await db
      .from("pairings")
      .select("source, prompt_version")
      .eq("user_id", userId)
      .throwOnError();
    expect(rows).toHaveLength(first.stats.neededPairs);
    expect(rows.every((r) => r.source === "ai" && r.prompt_version === PROMPT_VERSION)).toBe(true);

    vi.mocked(ai.judgePairing).mockClear();
    const second = await outfits();
    expect(judgeCalls()).toBe(0);
    expect(second.stats).toMatchObject({ cached: first.stats.neededPairs, judged: 0, judgeCalls: 0 });
    expect(second.outfits).toEqual(first.outfits);
    expect(second.summary).toEqual(first.summary);
  });

  it("stamps each verdict with the later updated_at of its two items, not the app clock", async () => {
    await outfits();
    const { data: items } = await db.from("items").select("id, updated_at").eq("user_id", userId).throwOnError();
    const updatedAt = new Map(items.map((i) => [i.id, Date.parse(i.updated_at)]));
    const { data: rows } = await db
      .from("pairings")
      .select("item_a_id, item_b_id, created_at")
      .eq("user_id", userId)
      .throwOnError();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const later = Math.max(updatedAt.get(row.item_a_id)!, updatedAt.get(row.item_b_id)!);
      expect(Date.parse(row.created_at)).toBe(later);
    }
  });

  it("only re-asks pairs of an item whose tags changed", async () => {
    const first = await outfits();
    const jeans = byTitle("Dark straight-leg jeans");
    await db.from("items").update({ user_tags: { formality: 3 } }).eq("id", jeans).throwOnError();

    vi.mocked(ai.judgePairing).mockClear();
    const second = await outfits();
    const asked = vi
      .mocked(ai.judgePairing)
      .mock.calls.flatMap(([input]) => input.pairs.map((p) => [p.a.id, p.b.id]));
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((ids) => ids.includes(jeans))).toBe(true);
    expect(second.stats.cached).toBeGreaterThan(0);
    expect(second.stats.cached + second.stats.judged).toBe(second.stats.neededPairs);
    expect(second.summary).not.toEqual(first.summary);

    await db.from("items").update({ user_tags: {} }).eq("id", jeans).throwOnError();
  });

  it("uses cached verdicts as stored, even when they say no", async () => {
    const coat = byTitle("Camel wool coat");
    const before = await outfits();
    expect(before.summary.byItem[coat]).toBeGreaterThan(0);

    await db
      .from("pairings")
      .update({ pairs: false })
      .or(`item_a_id.eq.${coat},item_b_id.eq.${coat}`)
      .throwOnError();
    vi.mocked(ai.judgePairing).mockClear();
    const after = await outfits();
    expect(judgeCalls()).toBe(0);
    expect(after.summary.byItem[coat]).toBe(0);
  });

  it("counts only active items", async () => {
    const sneakers = byTitle("White leather sneakers");
    expect((await outfits()).summary.byItem).toHaveProperty(sneakers);

    await db.from("items").update({ status: "passing_on" }).eq("id", sneakers).throwOnError();
    const result = await outfits();
    expect(result.summary.byItem).not.toHaveProperty(sneakers);
    expect(result.outfits.some((o) => o.itemIds.includes(sneakers))).toBe(false);

    await db.from("items").update({ status: "active" }).eq("id", sneakers).throwOnError();
  });

  it("adds an unsaved candidate: closet pairs from the cache, its own never cached", async () => {
    const sneakers = SAMPLE_CLOSET.find((i) => i.title === "White leather sneakers")!;
    const candidate = { title: "Candidate sneakers", tags: sneakers.tags };
    const pairRows = async () =>
      (await db.from("pairings").select("item_a_id, item_b_id").eq("user_id", userId).throwOnError()).data;

    const before = await computeClosetOutfits(db, userId, ai.judgePairing);
    const rowsBefore = await pairRows();
    vi.mocked(ai.judgePairing).mockClear();

    const after = await computeClosetOutfits(db, userId, ai.judgePairing, candidate);
    expect(after.summary.byItem[CANDIDATE_ITEM_ID]).toBeGreaterThan(0);
    expect(after.summary.total).toBeGreaterThan(before.summary.total);
    expect(after.stats.cached).toBe(before.stats.neededPairs);
    const asked = vi
      .mocked(ai.judgePairing)
      .mock.calls.flatMap(([input]) => input.pairs.map((p) => [p.a.id, p.b.id]));
    expect(asked.length).toBe(after.stats.judged);
    expect(asked.every((ids) => ids.includes(CANDIDATE_ITEM_ID))).toBe(true);
    expect(await pairRows()).toEqual(rowsBefore);

    vi.mocked(ai.judgePairing).mockClear();
    const again = await computeClosetOutfits(db, userId, ai.judgePairing, candidate);
    expect(judgeCalls()).toBe(after.stats.judgeCalls);
    expect(again.outfits).toEqual(after.outfits);
  });

  it("reads the temperature range from tags, user edits first", async () => {
    const sandals = byTitle("Tan block-heel sandals");
    expect((await outfits()).summary.byItem[sandals]).toBeGreaterThan(0);

    const freezing = { tempRangeF: { min: -20, max: -10 } };
    await db.from("items").update({ user_tags: freezing }).eq("id", sandals).throwOnError();
    expect((await outfits()).summary.byItem[sandals]).toBe(0);

    await db.from("items").update({ user_tags: {} }).eq("id", sandals).throwOnError();
  });

  it("skips items without tags instead of failing", async () => {
    const id = randomUUID();
    await db
      .from("items")
      .insert({ id, user_id: userId, entry_method: "link", title: "Pending", category: "top" })
      .throwOnError();
    const result = await outfits();
    expect(result.skippedItemIds).toEqual([id]);
    await db.from("items").delete().eq("id", id).throwOnError();
  });

  it("stores each pair once, smaller id first", async () => {
    await outfits();
    const { data: rows } = await db
      .from("pairings")
      .select("item_a_id, item_b_id")
      .eq("user_id", userId)
      .throwOnError();
    const keys = rows.map((r) => pairKey(r.item_a_id, r.item_b_id));
    expect(new Set(keys).size).toBe(rows.length);
    expect(rows.every((r) => r.item_a_id < r.item_b_id)).toBe(true);
  });

  it("goes on when an item is deleted while its pairs are judged, caching the rest", async () => {
    const id = randomUUID();
    const top = SAMPLE_CLOSET.find((i) => i.tags.category === "top")!;
    await db
      .from("items")
      .insert({ id, user_id: userId, entry_method: "manual", title: "Deleted mid-check", category: "top", ai_tags: top.tags })
      .throwOnError();
    let deleted = false;
    const judge: JudgeFn = async (input) => {
      if (!deleted) {
        deleted = true;
        await db.from("items").delete().eq("id", id).throwOnError();
      }
      return ai.judgePairing(input);
    };

    const result = await computeClosetOutfits(db, userId, judge);
    expect(deleted).toBe(true);
    expect(result.outfits.some((o) => o.itemIds.includes(id))).toBe(true);
    const { data: rows } = await db
      .from("pairings")
      .select("id")
      .or(`item_a_id.eq.${id},item_b_id.eq.${id}`)
      .throwOnError();
    expect(rows).toEqual([]);
    // Every other pair was saved: the next run asks nothing.
    expect((await outfits()).stats.judged).toBe(0);
  });
});
