import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkBudget,
  costUsd,
  DEFAULT_DAILY_BUDGET_USD,
  MAX_COST_USD,
  recordSpend,
  resetBudget,
  spentTodayUsd,
} from "./budget";
import { AiBudgetError } from "./errors";

beforeEach(() => resetBudget());
afterEach(() => vi.unstubAllEnvs());

describe("costUsd", () => {
  it("bills cached input at the cached rate and adds searches", () => {
    const usage = { input_tokens: 2_000_000, input_tokens_details: { cached_tokens: 1_000_000 }, output_tokens: 1_000_000 };
    expect(costUsd(usage, 4)).toBeCloseTo(1.25 + 0.15 + 4.25 + 0.01, 9);
  });
});

describe("checkBudget", () => {
  it("allows a call that fits in today's budget", async () => {
    recordSpend(DEFAULT_DAILY_BUDGET_USD - MAX_COST_USD.parseFeeling);
    await expect(checkBudget("parseFeeling")).resolves.toBeUndefined();
  });

  it("refuses a call whose worst case would pass the budget", async () => {
    recordSpend(DEFAULT_DAILY_BUDGET_USD - MAX_COST_USD.parseFeeling / 2);
    await expect(checkBudget("parseFeeling")).rejects.toBeInstanceOf(AiBudgetError);
    expect(spentTodayUsd()).toBeGreaterThan(0);
  });

  it("reads the budget from AI_DAILY_BUDGET_USD", async () => {
    vi.stubEnv("AI_DAILY_BUDGET_USD", "0");
    await expect(checkBudget("judgePairing")).rejects.toBeInstanceOf(AiBudgetError);
  });
});
