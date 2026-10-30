import type { AiFunctionName } from "./define";
import { dbBudgetStore } from "./budget-db";
import { AiBudgetError } from "./errors";

// Muse Spark 1.3 Standard prices in USD (dev.meta.ai/docs/pricing-rate-limits,
// read 2026-10-26). Reasoning tokens bill as output tokens.
export const PRICE_PER_M_TOKENS = { input: 1.25, cachedInput: 0.15, output: 4.25 };
export const PRICE_PER_WEB_SEARCH = 0.0025;
// Muse Voice Transcribe, billed per whole second of audio (same page).
export const PRICE_PER_AUDIO_HOUR = 0.18;
// Muse Image, a flat price per returned image (same page).
export const PRICE_PER_IMAGE = 0.01;

export const DEFAULT_DAILY_BUDGET_USD = 7;

// Worst-case cost of one live attempt: a generous input estimate plus the
// function's max_output_tokens (reasoning included; even "low" effort used
// 600-1,400 reasoning tokens for parseFeeling), plus searches for
// extractItem. Functions without a live call yet get a placeholder.
export const MAX_COST_USD: Record<AiFunctionName, number> = {
  extractItem: 0.05,
  parseFeeling: 0.015,
  judgePairing: 0.035,
  judgeRepeat: 0.02,
  // Three minutes of audio, the longest recording, is $0.009.
  transcribe: 0.01,
  scorePurchase: 0.05,
  renderOutfit: 0.05,
  buildProfile: 0.03,
  // One Muse Image picture.
  segmentGarment: PRICE_PER_IMAGE,
  summarizeWear: 0.02,
};

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number | null } | null;
}

export function costUsd(usage: TokenUsage | null | undefined, webSearches = 0): number {
  const searchCost = webSearches * PRICE_PER_WEB_SEARCH;
  if (!usage) return searchCost;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const tokens =
    (usage.input_tokens - cached) * PRICE_PER_M_TOKENS.input +
    cached * PRICE_PER_M_TOKENS.cachedInput +
    usage.output_tokens * PRICE_PER_M_TOKENS.output;
  return tokens / 1_000_000 + searchCost;
}

export function audioCostUsd(durationMs: number): number {
  return (Math.floor(durationMs / 1000) * PRICE_PER_AUDIO_HOUR) / 3600;
}

// Days are counted in Chicago time.
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

export function dailyBudgetUsd(): number {
  const raw = process.env.AI_DAILY_BUDGET_USD;
  const usd = raw ? Number(raw) : NaN;
  return Number.isFinite(usd) && usd >= 0 ? usd : DEFAULT_DAILY_BUDGET_USD;
}

// Where the day's spend is kept: the ai_budget_days table, shared by every
// server instance. Unit tests swap in memoryBudgetStore().
export interface BudgetStore {
  // Adds usd to the day's spend unless that would pass limit. False if not.
  reserve(day: string, usd: number, limit: number): Promise<boolean>;
  // Adds usd to the day's spend; negative gives some back.
  settle(day: string, usd: number): Promise<void>;
  spent(day: string): Promise<number>;
}

let store: BudgetStore | undefined;

function budgetStore(): BudgetStore {
  return (store ??= dbBudgetStore());
}

// Test hook.
export function setBudgetStore(next: BudgetStore): void {
  store = next;
}

export async function spentTodayUsd(): Promise<number> {
  return budgetStore().spent(today());
}

export async function recordSpend(usd: number): Promise<void> {
  if (usd > 0) await budgetStore().settle(today(), usd);
}

export interface BudgetHold {
  day: string;
  usd: number;
}

// Holds the worst-case cost of one live attempt, or refuses it if that could
// push today's spend over the budget. Runs before every live attempt,
// including retries; releaseBudget gives the hold back once recordSpend has
// added the real cost.
export async function reserveBudget(fn: AiFunctionName): Promise<BudgetHold> {
  const hold = { day: today(), usd: MAX_COST_USD[fn] };
  if (!(await budgetStore().reserve(hold.day, hold.usd, dailyBudgetUsd()))) {
    throw new AiBudgetError(fn);
  }
  return hold;
}

export async function releaseBudget(hold: BudgetHold): Promise<void> {
  await budgetStore().settle(hold.day, -hold.usd);
}

// Same rules as the database functions, kept in memory: for unit tests.
export function memoryBudgetStore(): BudgetStore {
  const days = new Map<string, number>();
  return {
    async reserve(day, usd, limit) {
      const spent = days.get(day) ?? 0;
      if (spent + usd > limit) return false;
      days.set(day, spent + usd);
      return true;
    },
    async settle(day, usd) {
      days.set(day, (days.get(day) ?? 0) + usd);
    },
    async spent(day) {
      return days.get(day) ?? 0;
    },
  };
}
