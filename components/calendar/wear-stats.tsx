import Link from "next/link";
import type { ReactNode } from "react";
import { ItemImage } from "@/components/closet/item-image";
import type { ClosetCard } from "@/lib/closet/items";
import { OCCASION_LABELS } from "@/lib/closet/labels";
import { shortDay } from "@/lib/wear/day";
import type { WearStats } from "@/lib/wear/stats";

export function timesWorn(count: number): string {
  return count === 0 ? "Not once" : count === 1 ? "Once" : `${count} times`;
}

// "Last 30 days", or the window's last day when the log stopped before today.
export function windowTitle(stats: WearStats, today: string): string {
  return stats.to >= today ? "Last 30 days" : `30 days to ${shortDay(stats.to)}`;
}

// The numbers, counted in code: shown with or without the model's insights.
export function WearStatsView({
  stats,
  items,
  today,
}: {
  stats: WearStats | null;
  items: Map<string, ClosetCard>;
  today: string;
}) {
  if (!stats) {
    return (
      <Section title="Last 30 days">
        <p className="text-sm text-ink-2">Nothing logged yet. Pick a day and add what you wore.</p>
      </Section>
    );
  }
  const list = (ids: string[]) => ids.flatMap((id) => items.get(id) ?? []);
  return (
    <Section
      title={windowTitle(stats, today)}
      note={`${stats.loggedDays} day${stats.loggedDays === 1 ? "" : "s"} logged · ${stats.outfitCount} outfit${stats.outfitCount === 1 ? "" : "s"}`}
    >
      <div className="grid gap-x-4 gap-y-10 md:grid-cols-2">
        <StatList title="Most worn" items={list(stats.mostWorn)} stats={stats} />
        <StatList title="Not worn" items={list(stats.notWorn)} stats={stats} />
        <StatList title="You love it, you skip it" items={list(stats.lovedSkipped)} stats={stats} />
        <StatList title="You complain, you wear it" items={list(stats.complainedWorn)} stats={stats} />
      </div>
      {stats.occasions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm text-ink-2">By occasion</h3>
          <dl className="border-t border-line text-sm">
            {stats.occasions.map((o) => (
              <div key={o.occasion} className="grid grid-cols-[6rem_1fr] gap-3 border-b border-line py-3">
                <dt>{OCCASION_LABELS[o.occasion]}</dt>
                <dd className="text-ink-2">
                  {o.outfitsLogged} outfit{o.outfitsLogged === 1 ? "" : "s"}, {o.distinctOutfits} different
                  {o.wanted > 0 && ` · you want ${o.wanted} a season`}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Section>
  );
}

function StatList({ title, items, stats }: { title: string; items: ClosetCard[]; stats: WearStats }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm text-ink-2">{title}</h3>
      {items.length === 0 ? (
        <p className="border-t border-line pt-3 text-sm text-ink-2">Nothing here.</p>
      ) : (
        <ul className="border-t border-line">
          {items.map((item) => (
            <li key={item.id} className="border-b border-line">
              <Link href={`/closet/${item.id}`} className="group flex items-center gap-3 py-2">
                <span className="w-10 shrink-0">
                  <ItemImage src={item.imageUrl} alt="" category={item.category} swatch={item.swatch} sizes="40px" aspect="aspect-square" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm group-hover:underline">{item.title}</span>
                <span className="shrink-0 text-sm text-ink-2 tabular-nums">{timesWorn(stats.byItem.get(item.id)?.count ?? 0)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="stats-heading" className="flex flex-col gap-6 border-t border-ink pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="stats-heading" className="text-lg font-medium">
          {title}
        </h2>
        {note && <span className="text-sm text-ink-2">{note}</span>}
      </div>
      {children}
    </section>
  );
}
