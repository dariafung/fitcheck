import Link from "next/link";
import type { ReactNode } from "react";
import { ItemImage } from "@/components/closet/item-image";
import type { ClosetCard } from "@/lib/closet/items";
import type { VisibleInsights } from "@/lib/wear/insights";

// Shared by the server page and the client one that swaps in fresh insights,
// so no server-only imports here.

// Fixed zone so the server and the browser print the same day.
const AS_OF = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });

export function InsightsView({ insights, items, note }: { insights: VisibleInsights; items: ClosetCard[]; note?: string }) {
  const cards = new Map(items.map((i) => [i.id, i]));
  return (
    <InsightSection note={note ?? (insights.current ? undefined : `As of ${AS_OF.format(new Date(insights.generatedAt))}`)}>
      <ul className="flex flex-col border-t border-line">
        {insights.insights.map((insight) => (
          <li key={insight.text} className="flex flex-col gap-3 border-b border-line py-4">
            <p className="font-serif text-lg">{insight.text}</p>
            <ul className="flex flex-wrap gap-1">
              {insight.itemIds.flatMap((id) => cards.get(id) ?? []).map((item) => (
                <li key={item.id} className="w-10">
                  <Link href={`/closet/${item.id}`} aria-label={item.title} className="block">
                    <ItemImage src={item.imageUrl} alt="" category={item.category} swatch={item.swatch} sizes="40px" aspect="aspect-square" />
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-2">Written by AI from your log and notes.</p>
    </InsightSection>
  );
}

// Too few days, or nothing to say yet.
export function InsightsEmpty({ daysToGo, message }: { daysToGo: number; message?: string }) {
  const text =
    message ??
    (daysToGo > 0
      ? `Log ${daysToGo} more day${daysToGo === 1 ? "" : "s"} to get insights.`
      : "Nothing stands out yet.");
  return (
    <InsightSection>
      <p className="text-sm text-ink-2">{text}</p>
    </InsightSection>
  );
}

export function InsightsSkeleton({ note }: { note?: string }) {
  return (
    <InsightSection note={note}>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="h-5 w-full bg-tile motion-safe:animate-pulse" />
        <div className="h-5 w-3/4 bg-tile motion-safe:animate-pulse" />
        <div className="h-5 w-2/3 bg-tile motion-safe:animate-pulse" />
      </div>
    </InsightSection>
  );
}

function InsightSection({ note, children }: { note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="insights-heading" className="flex flex-col gap-4 border-t border-ink pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="insights-heading" className="text-lg font-medium">
          What we noticed
        </h2>
        {note && (
          <span role="status" className="text-sm text-ink-2">
            {note}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
