"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { ClosetCard } from "@/lib/closet/items";
import { canLogOn, localDay, longDay } from "@/lib/wear/day";
import { monthLabel, monthOf, monthWeeks, shiftMonth } from "@/lib/wear/month";
import type { LoggedOutfit } from "@/lib/wear/stats";
import { ItemImage } from "@/components/closet/item-image";
import { DayPanel } from "./day-panel";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Color squares a phone cell has room for.
const PHONE_SWATCHES = 4;
// Photos a desktop cell has room for (from the first outfit).
const DESKTOP_PHOTOS = 3;

// The day never changes while the page is open; only the server and the
// browser disagree on it, so the server renders without one.
const noSubscribe = () => () => {};

// The month grid and, beside it on a desktop (below it on a phone), the
// picked day's outfits. "Today" is the browser's own day, so it's filled in
// once the page runs in the browser.
export function Calendar({
  month,
  outfits,
  items,
  readOnly,
  initialDay,
}: {
  month: string;
  outfits: LoggedOutfit[];
  items: ClosetCard[];
  readOnly: boolean;
  initialDay: string | null;
}) {
  const byDay = new Map<string, LoggedOutfit[]>();
  for (const o of outfits) byDay.set(o.date, [...(byDay.get(o.date) ?? []), o]);
  const lastLogged = outfits.at(-1)?.date ?? null;
  const cards = new Map(items.map((i) => [i.id, i]));

  const today = useSyncExternalStore(noSubscribe, localDay, () => null);
  const [picked, setPicked] = useState<string | null>(initialDay);
  // Unpicked, a writer starts on today when it's in this month; the demo,
  // which can't log, on its latest day.
  const selected = picked ?? (readOnly ? lastLogged : today === null ? null : monthOf(today) === month ? today : lastLogged);

  function pick(day: string) {
    setPicked(day);
    // Keeps the pick on reload without asking the server for the page again.
    window.history.replaceState(null, "", `?month=${month}&day=${day}`);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => document.getElementById("day-panel")?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  const atLatestMonth = today !== null && month >= monthOf(today);

  return (
    <div className="grid gap-x-4 gap-y-10 lg:grid-cols-12">
      <section aria-labelledby="month-heading" className="flex flex-col gap-4 lg:col-span-8">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <Link href={`/calendar?month=${shiftMonth(month, -1)}`} scroll={false} aria-label="Previous month" className="btn-text px-2 text-lg text-ink no-underline">
            ←
          </Link>
          <h2 id="month-heading" className="text-lg font-medium">
            {monthLabel(month)}
          </h2>
          {atLatestMonth ? (
            <span aria-hidden="true" className="w-6" />
          ) : (
            <Link href={`/calendar?month=${shiftMonth(month, 1)}`} scroll={false} aria-label="Next month" className="btn-text px-2 text-lg text-ink no-underline">
              →
            </Link>
          )}
        </div>
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" className="pb-2 text-xs font-normal text-ink-2">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthWeeks(month).map((week, w) => (
              <tr key={w}>
                {week.map((day, d) => (
                  <td key={d} className="border border-line p-0 align-top">
                    {day && (
                      <DayCell
                        day={day}
                        outfits={byDay.get(day) ?? []}
                        cards={cards}
                        selected={day === selected}
                        today={day === today}
                        future={today !== null && day > today}
                        onPick={() => pick(day)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div id="day-panel" className="scroll-mt-4 lg:sticky lg:top-10 lg:col-span-4 lg:self-start">
        {selected ? (
          <DayPanel
            key={selected}
            day={selected}
            outfits={byDay.get(selected) ?? []}
            items={items}
            readOnly={readOnly}
            editable={!readOnly && today !== null && canLogOn(selected, today)}
          />
        ) : (
          <p className="border-t border-ink pt-6 text-sm text-ink-2">Pick a day to see what you wore.</p>
        )}
      </div>
    </div>
  );
}

function DayCell({
  day,
  outfits,
  cards,
  selected,
  today,
  future,
  onPick,
}: {
  day: string;
  outfits: LoggedOutfit[];
  cards: Map<string, ClosetCard>;
  selected: boolean;
  today: boolean;
  future: boolean;
  onPick: () => void;
}) {
  const pieces = [...new Set(outfits.flatMap((o) => o.itemIds))].flatMap((id) => cards.get(id) ?? []);
  const firstPhotos = (outfits[0]?.itemIds ?? []).flatMap((id) => cards.get(id) ?? []);
  const label = `${longDay(day)}${outfits.length > 0 ? `, ${outfits.length} outfit${outfits.length === 1 ? "" : "s"}` : ""}`;

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={future}
      aria-pressed={selected}
      aria-label={label}
      className={`flex min-h-14 w-full flex-col gap-1 p-1 text-left transition-colors duration-150 md:min-h-28 md:p-1.5 ${
        selected ? "bg-ink text-paper" : "hover:bg-tile disabled:text-ink-2/50 disabled:hover:bg-transparent"
      }`}
    >
      <span className="flex items-start justify-between text-xs tabular-nums">
        <span className={today ? "font-medium underline underline-offset-4" : undefined}>{Number(day.slice(8))}</span>
        {outfits.length > 1 && <span className="md:hidden">{outfits.length}</span>}
      </span>
      {pieces.length > 0 && (
        <span aria-hidden="true" className="flex flex-wrap gap-0.5 md:hidden">
          {pieces.slice(0, PHONE_SWATCHES).map((p) => (
            <span key={p.id} className="size-2 border border-ink/15" style={{ backgroundColor: p.swatch }} />
          ))}
          {pieces.length > PHONE_SWATCHES && <span className="text-[9px] leading-2">+{pieces.length - PHONE_SWATCHES}</span>}
        </span>
      )}
      {firstPhotos.length > 0 && (
        <span aria-hidden="true" className="hidden flex-col gap-1 md:flex">
          <span className="grid grid-cols-3 gap-0.5">
            {firstPhotos.slice(0, DESKTOP_PHOTOS).map((p) => (
              <ItemImage
                key={p.id}
                src={p.imageUrl}
                alt=""
                category={p.category}
                swatch={p.swatch}
                sizes="40px"
                aspect="aspect-square"
              />
            ))}
          </span>
          {outfits.length > 1 && <span className="text-xs">+{outfits.length - 1} outfit{outfits.length > 2 ? "s" : ""}</span>}
        </span>
      )}
    </button>
  );
}
