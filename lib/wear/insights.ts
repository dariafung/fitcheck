// What the model noticed in the outfit log (P1-4): one cached set per user
// in wear_insights, written again when the log or the feelings change, at
// most once a Chicago day. The stats never wait on it.
import { z } from "zod";
import { inputHash } from "@/lib/ai/hash";
import {
  PROMPT_VERSION,
  SummarizeWearInput,
  WearInsight,
  type SummarizeWearOutput,
} from "@/lib/ai/schemas/summarize-wear";
import type { Db } from "@/lib/db/server";
import { chicagoDay, daysBetween } from "./day";
import type { WearLog } from "./log";
import { MIN_LOGGED_DAYS, NEW_ITEM_DAYS, WINDOW_DAYS } from "./stats";

export type SummarizeFn = (input: SummarizeWearInput) => Promise<SummarizeWearOutput>;

type Input = z.output<typeof SummarizeWearInput>;

// What summarizeWear sees: every active item, sorted by id so the same log
// always hashes the same. Null until MIN_LOGGED_DAYS days are logged.
export function wearInput(log: WearLog): Input | null {
  const { stats } = log;
  if (!stats || stats.loggedDays < MIN_LOGGED_DAYS) return null;
  const active = log.items.filter((i) => i.status === "active").sort((a, b) => (a.id < b.id ? -1 : 1));
  if (active.length === 0) return null;
  return SummarizeWearInput.parse({
    windowDays: WINDOW_DAYS,
    loggedDays: stats.loggedDays,
    outfitCount: stats.outfitCount,
    items: active.map((item) => {
      const wear = stats.byItem.get(item.id);
      return {
        id: item.id,
        title: item.title,
        tags: item.tags,
        wornCount: wear?.count ?? 0,
        lastWornDaysAgo: wear?.lastWorn ? daysBetween(wear.lastWorn, stats.to) : null,
        addedDaysAgo: addedDaysAgo(item.addedOn, stats.to),
        feeling: item.feeling && {
          flattering: item.feeling.flattering,
          liked: item.feeling.liked,
          aspects: item.feeling.aspects,
        },
      };
    }),
    occasions: stats.occasions,
  });
}

// Only a piece added under a week before the log's last day counts as new,
// the same line the stats draw for not worn.
function addedDaysAgo(addedOn: string, to: string): number | null {
  const days = Math.max(0, daysBetween(addedOn, to));
  return days < NEW_ITEM_DAYS ? days : null;
}

export function wearHash(input: Input): string {
  return inputHash("summarizeWear", PROMPT_VERSION, input);
}

// Logged days still needed before there are insights.
export function daysToGo(log: WearLog): number {
  return Math.max(0, MIN_LOGGED_DAYS - (log.stats?.loggedDays ?? 0));
}

interface Stored {
  insights: WearInsight[];
  inputHash: string;
  generatedAt: string;
}

async function loadStored(db: Db, userId: string): Promise<Stored | null> {
  const { data } = await db
    .from("wear_insights")
    .select("insights, input_hash, prompt_version, generated_at")
    .eq("user_id", userId)
    .maybeSingle()
    .throwOnError();
  const insights = z.array(WearInsight).safeParse(data?.insights);
  if (!data || !insights.success) return null;
  return { insights: insights.data, inputHash: data.input_hash, generatedAt: new Date(data.generated_at).toISOString() };
}

export interface VisibleInsights {
  insights: WearInsight[];
  generatedAt: string;
  // Made from the log as it is now; otherwise from an earlier one.
  current: boolean;
}

// Insights about pieces that have all left the closet are dropped. Null
// when none are left.
function visible(stored: Stored, activeIds: ReadonlySet<string>, hash: string | null): VisibleInsights | null {
  const insights = stored.insights.flatMap((insight) => {
    const itemIds = insight.itemIds.filter((id) => activeIds.has(id));
    const kept = itemIds.length > 0 || (insight.kind === "occasion" && insight.itemIds.length === 0);
    return kept ? [{ ...insight, itemIds }] : [];
  });
  return insights.length > 0
    ? { insights, generatedAt: stored.generatedAt, current: stored.inputHash === hash }
    : null;
}

const activeIdsOf = (log: WearLog) => new Set(log.items.filter((i) => i.status === "active").map((i) => i.id));

const madeToday = (stored: Stored, now: Date) => chicagoDay(new Date(stored.generatedAt)) === chicagoDay(now);

export interface InsightState {
  insights: VisibleInsights | null;
  daysToGo: number;
  // The page should ask /api/wear/insights for a fresh set.
  refresh: boolean;
}

export async function loadInsightState(db: Db, userId: string, log: WearLog, now = new Date()): Promise<InsightState> {
  const input = wearInput(log);
  const hash = input && wearHash(input);
  const stored = await loadStored(db, userId);
  return {
    insights: stored && visible(stored, activeIdsOf(log), hash),
    daysToGo: daysToGo(log),
    refresh: hash !== null && stored?.inputHash !== hash && !(stored && madeToday(stored, now)),
  };
}

export type RefreshResult = { status: "not_enough"; daysToGo: number } | { status: "ready"; insights: VisibleInsights | null };

// Writes a fresh set if the log changed and none was made today. A failed
// call keeps the old set when there is one, else rethrows. Two tabs at once
// may both ask the model; that costs one extra call, so no lock.
export async function refreshInsights(
  db: Db,
  userId: string,
  log: WearLog,
  summarize: SummarizeFn,
  now = new Date(),
): Promise<RefreshResult> {
  const input = wearInput(log);
  if (!input) return { status: "not_enough", daysToGo: daysToGo(log) };
  const hash = wearHash(input);
  const activeIds = activeIdsOf(log);
  const stored = await loadStored(db, userId);
  if (stored && (stored.inputHash === hash || madeToday(stored, now))) {
    return { status: "ready", insights: visible(stored, activeIds, hash) };
  }

  let output: SummarizeWearOutput;
  try {
    output = await summarize(input);
  } catch (err) {
    if (stored) return { status: "ready", insights: visible(stored, activeIds, hash) };
    throw err;
  }
  const fresh = { insights: output.insights, inputHash: hash, generatedAt: now.toISOString() };
  await db
    .from("wear_insights")
    .upsert({
      user_id: userId,
      insights: output.insights,
      input_hash: hash,
      prompt_version: PROMPT_VERSION,
      generated_at: fresh.generatedAt,
    })
    .throwOnError();
  return { status: "ready", insights: visible(fresh, activeIds, hash) };
}
