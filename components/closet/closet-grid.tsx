import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { listClosetItems, type ClosetCard } from "@/lib/closet/items";
import { CLOSET_TABS, closetHref, inCategory, inTab, inTag, type ClosetView, type NotWorn } from "@/lib/closet/tabs";
import { categoryLabel } from "@/lib/closet/tags";
import { isReadOnly } from "@/lib/auth/session";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { loadWearLog } from "@/lib/wear/log";
import { wearLogEnabledFor } from "@/lib/wear/settings";
import { ClosetFilters, FILTER } from "./closet-filters";
import { ItemImage } from "./item-image";

// The shelf: 4:5 tiles. Four across on a desktop, 16px apart, 48px between
// rows. On a phone two across, 4px apart, pulled out to 8px from the screen
// edge so each tile is about half the screen, as on The Row, H&M, Everlane.
export const SHELF =
  "-mx-2 grid grid-cols-2 gap-x-1 gap-y-10 md:mx-0 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4 lg:gap-y-12";

export async function ClosetGrid({ view: viewParam }: { view: Promise<ClosetView> }) {
  await connection();
  const userId = await currentUserId();
  const [items, notWorn, asked, readOnly] = await Promise.all([
    listClosetItems(createServerClient(), userId),
    notWornIds(userId),
    viewParam,
    isReadOnly(),
  ]);

  if (items.length === 0) return <EmptyCloset />;

  // No "not worn" filter without a calendar to tell.
  const view = asked.tag === "not-worn" && !notWorn ? { ...asked, tag: null } : asked;
  const tabItems = inTab(items, view.tab);
  const shown = inCategory(inTag(tabItems, view.tag, notWorn), view.cat);
  return (
    <div className="flex flex-col gap-10">
      <ClosetFilters items={items} view={view} notWorn={notWorn} />
      {shown.length > 0 ? (
        <ItemList items={shown} addSlot={view.tab === "wearing" && !readOnly} />
      ) : tabItems.length > 0 ? (
        <Empty title="Nothing in this category." text="Pick another one, or see everything.">
          <Link href={closetHref({ ...view, cat: null, tag: null })} scroll={false} className="btn-secondary mt-4">
            Show all
          </Link>
        </Empty>
      ) : view.tab === "passing-on" ? (
        <Empty title="Nothing to pass on." text="Clothes you plan to sell or give away show up here." />
      ) : (
        <Empty title="Nothing left to wear." text="Everything is in Passing on. Add something new to fill your closet back up." />
      )}
    </div>
  );
}

// The same 30 days the calendar counts as "Not worn".
async function notWornIds(userId: string): Promise<NotWorn> {
  if (!(await wearLogEnabledFor(userId))) return null;
  const { stats } = await loadWearLog(createServerClient(), userId);
  return stats && new Set(stats.notWorn);
}

// An empty slot on the shelf: a tile outlined in a dashed line, the words
// beside it.
function EmptySlot({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-end gap-6 md:gap-10">
      <div
        aria-hidden
        className="aspect-[4/5] w-28 shrink-0 bg-tile outline-1 -outline-offset-[10px] outline-ink/30 outline-dashed md:w-56"
      />
      <div className="flex max-w-sm flex-col items-start gap-2 pb-1">{children}</div>
    </div>
  );
}

function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <EmptySlot>
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm text-ink-2">{text}</p>
      {children}
    </EmptySlot>
  );
}

export function EmptyCloset() {
  return (
    <EmptySlot>
      <p className="text-lg font-medium">Your closet is empty.</p>
      <p className="text-sm text-ink-2">Add a few things you own to get started.</p>
      <Link href="/closet/add" className="btn-primary mt-4">
        Add your first piece
      </Link>
    </EmptySlot>
  );
}

// Shown only where the last row has a gap at that width (2, 3 or 4 across),
// so a short row reads as full and the gap becomes the way to add more.
function addSlotVisibility(count: number): string {
  return [
    count % 2 === 0 ? "hidden" : "block",
    count % 3 === 0 ? "md:hidden" : "md:block",
    count % 4 === 0 ? "lg:hidden" : "lg:block",
  ].join(" ");
}

export function ItemList({
  items,
  grid = SHELF,
  addSlot = false,
  phoneLimit,
}: {
  items: ClosetCard[];
  grid?: string;
  addSlot?: boolean;
  // Tiles shown on a phone; the rest appear from 768 px.
  phoneLimit?: number;
}) {
  return (
    <ul className={grid}>
      {items.map((item, i) => (
        <li key={item.id} className={phoneLimit !== undefined && i >= phoneLimit ? "hidden md:block" : undefined}>
          <Link href={`/closet/${item.id}`} className="group block">
            <ItemImage
              src={item.imageUrl}
              alt={item.title}
              category={item.category}
              swatch={item.swatch}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              priority={i < 4}
            />
            <div className="px-1 md:px-0">
              <p className="mt-2 line-clamp-2 text-sm leading-snug decoration-1 underline-offset-[3px] group-hover:underline">
                {item.title}
              </p>
              {/* How it feels, in the AI's one line; the type until there is one. */}
              <p className="line-clamp-1 text-sm text-ink-2">{item.note ?? categoryLabel(item.category)}</p>
            </div>
          </Link>
        </li>
      ))}
      {addSlot && (
        <li className={addSlotVisibility(items.length)}>
          <Link href="/closet/add" className="group block">
            <div className="flex aspect-[4/5] items-center justify-center bg-tile outline-1 -outline-offset-[10px] outline-ink/30 outline-dashed transition-colors duration-150 group-hover:outline-ink">
              <span className="text-sm text-ink-2 transition-colors duration-150 group-hover:text-ink">Add clothes</span>
            </div>
          </Link>
        </li>
      )}
    </ul>
  );
}

export function ClosetGridSkeleton({ tabs = false, grid = SHELF }: { tabs?: boolean; grid?: string }) {
  const list = (
    <ul className={grid} aria-busy="true" aria-label="Loading your closet">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i}>
          <div className="aspect-[4/5] bg-tile motion-safe:animate-pulse" />
          <div className="mt-2 h-4 w-3/4 bg-tile motion-safe:animate-pulse" />
          <div className="mt-1 h-4 w-1/3 bg-tile motion-safe:animate-pulse" />
        </li>
      ))}
    </ul>
  );
  if (!tabs) return list;
  // Same height as the tab bar and the category row, so the grid does not
  // jump when it loads.
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col">
        <div className="flex items-center gap-8 border-y border-line py-3.5">
          {CLOSET_TABS.map((tab) => (
            <span key={tab.id} className={`${FILTER} text-ink-2/60`}>
              {tab.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-6 pt-4 pb-1">
          <span className={`${FILTER} py-1 text-ink-2/60`}>All</span>
        </div>
      </div>
      {list}
    </div>
  );
}
