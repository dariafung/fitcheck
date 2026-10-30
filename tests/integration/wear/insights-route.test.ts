import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/wear/insights/route";
import * as ai from "@/lib/ai";
import { memoryBudgetStore, setBudgetStore } from "@/lib/ai/budget";
import { AiBudgetError, AiOutputError } from "@/lib/ai/errors";
import { PROMPT_VERSION } from "@/lib/ai/schemas/summarize-wear";
import { MIN_LOGGED_DAYS } from "@/lib/wear/stats";
import { daysAgo, wearCloset } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: async () => user.id }));
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, summarizeWear: vi.fn(actual.summarizeWear) };
});

let closet: Awaited<ReturnType<typeof wearCloset>>;

beforeEach(async () => {
  setBudgetStore(memoryBudgetStore());
  vi.mocked(ai.summarizeWear).mockClear();
  closet = await wearCloset();
  user.id = closet.userId;
});
afterEach(async () => {
  await closet.cleanup();
});

// Tee and jeans on each of the last `days` days, sneakers to sport on the first.
async function logDays(days: number, from = 0) {
  await closet.db
    .from("outfit_logs")
    .insert(
      Array.from({ length: days }, (_, i) => ({
        user_id: closet.userId,
        worn_on: daysAgo(from + i),
        item_ids: [closet.tee, closet.jeans].sort(),
        occasion: "school",
      })),
    )
    .throwOnError();
}

async function stored() {
  const { data } = await closet.db.from("wear_insights").select("*").eq("user_id", closet.userId).maybeSingle().throwOnError();
  return data;
}

describe("POST /api/wear/insights", () => {
  it("waits for a week of logs without asking the model", async () => {
    await logDays(MIN_LOGGED_DAYS - 2);
    const res = await POST();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "NotEnoughDays", daysToGo: 2 });
    expect(ai.summarizeWear).not.toHaveBeenCalled();
  });

  it("writes insights about the user's own pieces and keeps them", async () => {
    await logDays(MIN_LOGGED_DAYS);
    const res = await POST();
    expect(res.status).toBe(200);
    const { insights } = await res.json();
    expect(insights.current).toBe(true);
    expect(insights.insights.length).toBeGreaterThan(0);
    for (const i of insights.insights) {
      for (const id of i.itemIds) expect([closet.tee, closet.jeans, closet.sneakers]).toContain(id);
    }
    const row = await stored();
    expect(row).toMatchObject({ prompt_version: PROMPT_VERSION });
    // The sneakers sat out the whole week.
    expect(JSON.stringify(row?.insights)).toContain("Test sneakers sat out");
  });

  it("asks the model once per log, and at most once a day", async () => {
    await logDays(MIN_LOGGED_DAYS);
    const first = await (await POST()).json();
    expect(await (await POST()).json()).toEqual(first);
    expect(ai.summarizeWear).toHaveBeenCalledTimes(1);

    // A new outfit today: the morning's insights stand, marked as older.
    await closet.db.from("outfit_logs").insert({ user_id: closet.userId, worn_on: daysAgo(0), item_ids: [closet.sneakers] }).throwOnError();
    const sameDay = await (await POST()).json();
    expect(sameDay.insights.current).toBe(false);
    expect(ai.summarizeWear).toHaveBeenCalledTimes(1);

    // The next day they're written again.
    await closet.db
      .from("wear_insights")
      .update({ generated_at: new Date(Date.now() - 2 * 86_400_000).toISOString() })
      .eq("user_id", closet.userId)
      .throwOnError();
    const nextDay = await (await POST()).json();
    expect(nextDay.insights.current).toBe(true);
    expect(ai.summarizeWear).toHaveBeenCalledTimes(2);
  });

  it("answers the budget notice when there's nothing to fall back on", async () => {
    await logDays(MIN_LOGGED_DAYS);
    vi.mocked(ai.summarizeWear).mockRejectedValueOnce(new AiBudgetError("summarizeWear"));
    const res = await POST();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("AiBudgetError");
    expect(await stored()).toBeNull();
  });

  it("keeps the old insights when a fresh set fails", async () => {
    await logDays(MIN_LOGGED_DAYS);
    const first = await (await POST()).json();
    await closet.db
      .from("wear_insights")
      .update({ generated_at: new Date(Date.now() - 2 * 86_400_000).toISOString() })
      .eq("user_id", closet.userId)
      .throwOnError();
    await logDays(1, MIN_LOGGED_DAYS);
    vi.mocked(ai.summarizeWear).mockRejectedValueOnce(new AiOutputError("summarizeWear", []));
    const res = await POST();
    expect(res.status).toBe(200);
    const { insights } = await res.json();
    expect(insights.current).toBe(false);
    expect(insights.insights).toEqual(first.insights.insights);
  });

  it("does nothing while the calendar is off", async () => {
    await logDays(MIN_LOGGED_DAYS);
    await closet.db.from("users").update({ wear_log_enabled: false }).eq("id", closet.userId).throwOnError();
    expect((await POST()).status).toBe(409);
    expect(ai.summarizeWear).not.toHaveBeenCalled();
  });
});
