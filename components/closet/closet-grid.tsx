import Link from "next/link";
import { connection } from "next/server";
import { listClosetItems, type ClosetCard } from "@/lib/closet/items";
import { CLOSET_TABS, inTab, type ClosetTab } from "@/lib/closet/tabs";
import { categoryLabel } from "@/lib/closet/tags";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { ItemImage } from "./item-image";

const GRID = "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3";

export async function ClosetGrid({ tab: tabParam }: { tab: Promise<ClosetTab> }) {
  await connection();
  const [items, tab] = await Promise.all([
    currentUserId().then((userId) => listClosetItems(createServerClient(), userId)),
    tabParam,
  ]);

  if (items.length === 0) return <EmptyCloset />;

  const shown = inTab(items, tab);
  return (
    <div className="flex flex-col gap-6">
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

const TAB = "-mb-px border-b-2 px-3 py-2 text-sm font-medium";

function ClosetTabs({ active, counts }: { active: ClosetTab; counts: Record<ClosetTab, number> }) {
  return (
    <div className="flex gap-2 border-b border-black/10 dark:border-white/15">
      {CLOSET_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          scroll={false}
          aria-current={tab.id === active ? "page" : undefined}
          className={`${TAB} ${
            tab.id === active
              ? "border-foreground"
              : "border-transparent text-foreground/60 hover:text-foreground"
          }`}
        >
          {tab.label} <span className="font-normal text-foreground/50">{counts[tab.id]}</span>
        </Link>
      ))}
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-black/15 px-6 py-12 text-center dark:border-white/20">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-foreground/60">{text}</p>
    </div>
  );
}

export function EmptyCloset() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/15 px-6 py-12 text-center dark:border-white/20">
      <p className="font-medium">Your closet is empty.</p>
      <p className="text-sm text-foreground/60">Add a few things you own to get started.</p>
      <Link
        href="/closet/add"
        className="mt-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Add your first piece
      </Link>
    </div>
  );
}

export function ItemList({ items }: { items: ClosetCard[] }) {
  return (
    <ul className={GRID}>
      {items.map((item, i) => (
        <li key={item.id}>
          <Link href={`/closet/${item.id}`} className="group block">
            <ItemImage
              src={item.imageUrl}
              alt={item.title}
              category={item.category}
              swatch={item.swatch}
              sizes="(min-width: 640px) 240px, 50vw"
              priority={i < 4}
            />
            <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug group-hover:underline">
              {item.title}
            </p>
            <p className="text-xs text-foreground/60">{categoryLabel(item.category)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ClosetGridSkeleton({ tabs = false }: { tabs?: boolean }) {
  const list = (
    <ul className={GRID} aria-busy="true" aria-label="Loading your closet">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i}>
          <div className="aspect-[3/4] animate-pulse rounded-xl bg-black/[.06] dark:bg-white/[.08]" />
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        </li>
      ))}
    </ul>
  );
  if (!tabs) return list;
  // Same height as the tab bar, so the grid does not jump when it loads.
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 border-b border-black/10 dark:border-white/15">
        {CLOSET_TABS.map((tab) => (
          <span key={tab.id} className={`${TAB} border-transparent text-foreground/40`}>
            {tab.label}
          </span>
        ))}
      </div>
      {list}
    </div>
  );
}
