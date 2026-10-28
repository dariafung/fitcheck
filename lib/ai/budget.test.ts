import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  costUsd,
  DEFAULT_DAILY_BUDGET_USD,
  MAX_COST_USD,
  memoryBudgetStore,
  recordSpend,
  releaseBudget,
  reserveBudget,
  setBudgetStore,
  spentTodayUsd,
  today,
} from "./budget";
import { AiBudgetError } from "./errors";

beforeEach(() => setBudgetStore(memoryBudgetStore()));
afterEach(() => vi.unstubAllEnvs());

describe("costUsd", () => {
  it("bills cached input at the cached rate and adds searches", () => {
    const usage = { input_tokens: 2_000_000, input_tokens_details: { cached_tokens: 1_000_000 }, output_tokens: 1_000_000 };
    expect(costUsd(usage, 4)).toBeCloseTo(1.25 + 0.15 + 4.25 + 0.01, 9);
  });
});

describe("today", () => {
  it("counts days in Chicago time", () => {
    // 03:00 UTC on Oct 28 is still Oct 27 in Chicago (UTC-5 in October).
    expect(today(new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-27");
    expect(today(new Date("2026-10-28T06:00:00Z"))).toBe("2026-10-28");
  });
});

describe("reserveBudget", () => {
  it("allows a call that fits in today's budget", async () => {
    await recordSpend(DEFAULT_DAILY_BUDGET_USD - MAX_COST_USD.parseFeeling);
    await expect(reserveBudget("parseFeeling")).resolves.toEqual({
      day: today(),
      usd: MAX_COST_USD.parseFeeling,
    });
  });

  it("refuses a call whose worst case would pass the budget", async () => {
    await recordSpend(DEFAULT_DAILY_BUDGET_USD - MAX_COST_USD.parseFeeling / 2);
    await expect(reserveBudget("parseFeeling")).rejects.toBeInstanceOf(AiBudgetError);
    expect(await spentTodayUsd()).toBeCloseTo(DEFAULT_DAILY_BUDGET_USD - MAX_COST_USD.parseFeeling / 2, 9);
  });

  it("counts calls in flight, so they cannot overspend together", async () => {
    vi.stubEnv("AI_DAILY_BUDGET_USD", String(MAX_COST_USD.judgePairing * 2.5));
    const results = await Promise.allSettled([1, 2, 3].map(() => reserveBudget("judgePairing")));
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled", "rejected"]);
  });

  it("leaves only the real cost once the hold is released", async () => {
    const hold = await reserveBudget("extractItem");
    await recordSpend(0.004);
    await releaseBudget(hold);
    expect(await spentTodayUsd()).toBeCloseTo(0.004, 9);
  });

  it("reads the budget from AI_DAILY_BUDGET_USD", async () => {
    vi.stubEnv("AI_DAILY_BUDGET_USD", "0");
    await expect(reserveBudget("judgePairing")).rejects.toBeInstanceOf(AiBudgetError);
  });
});
