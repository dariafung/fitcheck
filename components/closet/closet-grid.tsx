import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { listClosetItems, type ClosetCard } from "@/lib/closet/items";
import { CLOSET_TABS, inTab, type ClosetTab } from "@/lib/closet/tabs";
import { categoryLabel } from "@/lib/closet/tags";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { ItemImage } from "./item-image";

// The shelf: 4:5 tiles, 16px apart, 40px between rows. Four across on a
// desktop, two on a phone.
export const SHELF = "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4";

export async function ClosetGrid({ tab: tabParam }: { tab: Promise<ClosetTab> }) {
  await connection();
  const [items, tab] = await Promise.all([
    currentUserId().then((userId) => listClosetItems(createServerClient(), userId)),
    tabParam,
  ]);

  if (items.length === 0) return <EmptyCloset />;

  const shown = inTab(items, tab);
  return (
    <div className="flex flex-col gap-10">
      <ClosetTabs
        active={tab}
        counts={{ all: inTab(items, "all").length, "passing-on": inTab(items, "passing-on").length }}
      />
      {shown.length > 0 ? (
        <ItemList items={shown} />
      ) : tab === "passing-on" ? (
        <Empty title="Nothing to pass on." text="Clothes you plan to sell or give away show up here." />
      ) : (
        <Empty title="Nothing you're wearing right now." text="Add something new to fill it back up." />
      )}
    </div>
  );
}

const TAB =
  "text-sm underline-offset-[6px] decoration-2 transition-colors duration-150";

function ClosetTabs({ active, counts }: { active: ClosetTab; counts: Record<ClosetTab, number> }) {
  return (
    <div className="flex items-center gap-8 border-y border-line py-3.5">
      {CLOSET_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          scroll={false}
          aria-current={tab.id === active ? "page" : undefined}
          className={`${TAB} ${tab.id === active ? "text-ink underline" : "text-ink-2 hover:text-ink"}`}
        >
          {tab.label} <span className="text-ink-2 tabular-nums">{counts[tab.id]}</span>
        </Link>
      ))}
    </div>
  );
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

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <EmptySlot>
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm text-ink-2">{text}</p>
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

export function ItemList({ items, grid = SHELF }: { items: ClosetCard[]; grid?: string }) {
  return (
    <ul className={grid}>
      {items.map((item, i) => (
        <li key={item.id}>
          <Link href={`/closet/${item.id}`} className="group block">
            <ItemImage
              src={item.imageUrl}
              alt={item.title}
              category={item.category}
              swatch={item.swatch}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              priority={i < 4}
            />
            <p className="mt-2 line-clamp-2 text-sm leading-snug decoration-1 underline-offset-[3px] group-hover:underline">
              {item.title}
            </p>
            <p className="text-sm text-ink-2">{categoryLabel(item.category)}</p>
          </Link>
        </li>
      ))}
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
  // Same height as the tab bar, so the grid does not jump when it loads.
  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-8 border-y border-line py-3.5">
        {CLOSET_TABS.map((tab) => (
          <span key={tab.id} className={`${TAB} text-ink-2/60`}>
            {tab.label}
          </span>
        ))}
      </div>
      {list}
    </div>
  );
}
