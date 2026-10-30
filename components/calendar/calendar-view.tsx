import Link from "next/link";
import { connection } from "next/server";
import { EmptyCloset } from "@/components/closet/closet-grid";
import { isReadOnly } from "@/lib/auth/session";
import { listClosetItems } from "@/lib/closet/items";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { chicagoDay, IsoDate } from "@/lib/wear/day";
import { loadInsightState } from "@/lib/wear/insights";
import { loadWearLog } from "@/lib/wear/log";
import { monthOf, monthRange, parseMonth } from "@/lib/wear/month";
import { listOutfits } from "@/lib/wear/outfits";
import { wearLogEnabledFor } from "@/lib/wear/settings";
import type { WearStats } from "@/lib/wear/stats";
import { Calendar } from "./calendar";
import { InsightAutoUpdate } from "./insight-auto-update";
import { InsightsEmpty, InsightsView } from "./insight-view";
import { WearStatsView } from "./wear-stats";

type Params = Promise<{ [key: string]: string | string[] | undefined }>;

// The demo log never grows, so the demo opens on the month most of it is in.
function busiestMonth(stats: WearStats | null, outfits: { date: string }[]): string | null {
  if (!stats) return null;
  const days = new Map<string, Set<string>>();
  for (const { date } of outfits) days.set(monthOf(date), (days.get(monthOf(date)) ?? new Set()).add(date));
  return [...days].sort((a, b) => b[1].size - a[1].size || b[0].localeCompare(a[0]))[0]?.[0] ?? monthOf(stats.to);
}

export async function CalendarView({ searchParams }: { searchParams: Params }) {
  await connection();
  const [params, userId, readOnly] = await Promise.all([searchParams, currentUserId(), isReadOnly()]);
  if (!(await wearLogEnabledFor(userId))) return <CalendarOff />;

  const db = createServerClient();
  const [items, log] = await Promise.all([listClosetItems(db, userId), loadWearLog(db, userId)]);
  if (items.length === 0) return <EmptyCloset />;

  const month =
    parseMonth(params.month) ??
    (readOnly ? busiestMonth(log.stats, log.outfits) : null) ??
    monthOf(chicagoDay());
  const range = monthRange(month);
  const day = IsoDate.safeParse(params.day);
  const [outfits, insights] = await Promise.all([
    listOutfits(db, userId, range.from, range.to),
    loadInsightState(db, userId, log),
  ]);
  const cards = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="flex flex-col gap-16">
      <Calendar
        month={month}
        outfits={outfits}
        items={items}
        readOnly={readOnly}
        initialDay={day.success && monthOf(day.data) === month ? day.data : null}
      />
      <div className="grid gap-x-4 gap-y-16 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <WearStatsView stats={log.stats} items={cards} today={chicagoDay()} />
        </div>
        <div className="lg:col-span-4">
          {insights.refresh ? (
            <InsightAutoUpdate initial={insights.insights} items={items} />
          ) : insights.insights ? (
            <InsightsView insights={insights.insights} items={items} />
          ) : (
            <InsightsEmpty daysToGo={insights.daysToGo} />
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarOff() {
  return (
    <p className="notice">
      Your outfit calendar is off.{" "}
      <Link href="/profile#calendar" className="font-medium underline underline-offset-4">
        Turn it on in Profile
      </Link>
    </p>
  );
}

export function CalendarSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your calendar" className="flex flex-col gap-4 border-t border-ink pt-6">
      <div className="h-6 w-40 bg-tile motion-safe:animate-pulse" />
      <div className="aspect-[7/5] max-h-[560px] bg-tile motion-safe:animate-pulse" />
    </div>
  );
}
