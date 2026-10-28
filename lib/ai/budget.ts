import type { AiFunctionName } from "./define";
import { AiBudgetError } from "./errors";

// Muse Spark 1.3 Standard prices in USD (dev.meta.ai/docs/pricing-rate-limits,
// read 2026-10-26). Reasoning tokens bill as output tokens.
export const PRICE_PER_M_TOKENS = { input: 1.25, cachedInput: 0.15, output: 4.25 };
export const PRICE_PER_WEB_SEARCH = 0.0025;
// Muse Voice Transcribe, billed per whole second of audio (same page).
export const PRICE_PER_AUDIO_HOUR = 0.18;

export const DEFAULT_DAILY_BUDGET_USD = 4;

// Worst-case cost of one live attempt: a generous input estimate plus the
// function's max_output_tokens (reasoning included; even "low" effort used
// 600-1,400 reasoning tokens for parseFeeling), plus searches for
// extractItem. Functions without a live call yet get a placeholder.
export const MAX_COST_USD: Record<AiFunctionName, number> = {
  extractItem: 0.05,
  parseFeeling: 0.015,
  judgePairing: 0.035,
  // Three minutes of audio, the longest recording, is $0.009.
  transcribe: 0.01,
  scorePurchase: 0.05,
  renderOutfit: 0.05,
  buildProfile: 0.05,
  segmentGarment: 0.05,
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
function today(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

export function dailyBudgetUsd(): number {
  const raw = process.env.AI_DAILY_BUDGET_USD;
  const usd = raw ? Number(raw) : NaN;
  return Number.isFinite(usd) && usd >= 0 ? usd : DEFAULT_DAILY_BUDGET_USD;
}

// TODO(P0-7): in process memory for now, so it resets on restart and each
// server instance counts on its own. Move to a database table before deploy,
// together with the per-IP rate limit.
let ledger = { day: today(), spentUsd: 0 };

function current() {
  const day = today();
  if (ledger.day !== day) ledger = { day, spentUsd: 0 };
  return ledger;
}

export function spentTodayUsd(): number {
  return current().spentUsd;
}

export function recordSpend(usd: number): void {
  current().spentUsd += usd;
}

// Test hook.
export function resetBudget(): void {
  ledger = { day: today(), spentUsd: 0 };
}

// Refuses a live attempt that could push today's spend over the budget.
// Runs before every live attempt, including the retry.
export async function checkBudget(fn: AiFunctionName): Promise<void> {
  if (spentTodayUsd() + MAX_COST_USD[fn] > dailyBudgetUsd()) {
    throw new AiBudgetError(fn);
  }
}
