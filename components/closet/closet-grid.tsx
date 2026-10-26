import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { groupForToday } from "@/lib/closet/fit-today";
import { listClosetItems, type ClosetCard } from "@/lib/closet/items";
import { categoryLabel } from "@/lib/closet/tags";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { ATTRIBUTION } from "@/lib/weather/open-meteo";
import { todayWeather } from "@/lib/weather/today";
import { ItemImage } from "./item-image";

const GRID = "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3";

export async function ClosetGrid() {
  await connection();
  const userId = currentUserId();
  const [items, weather] = await Promise.all([
    listClosetItems(createServerClient(), userId),
    headers().then((h) => todayWeather(userId, h)),
  ]);

  if (items.length === 0) {
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

  const groups = groupForToday(items, weather && { min: weather.lowF, max: weather.highF });

  return (
    <div className="flex flex-col gap-10">
      {weather ? (
        <>
          <Group
            id="good-for-today"
            title="Good for today"
            note={`${weather.city ?? "Today"} · ${weather.lowF}–${weather.highF}°F`}
            items={groups.good}
            emptyText="Nothing here fits today's weather."
          />
          <Group id="not-for-today" title="Not for today" items={groups.notToday} />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground/60">
            Couldn&apos;t get today&apos;s weather, so here&apos;s everything.
          </p>
          <ItemList items={groups.good} />
        </div>
      )}
      <Group id="passing-on" title="Passing on" items={groups.passingOn} />
      {weather && (
        <p className="text-xs text-foreground/50">
          <a href={ATTRIBUTION.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {ATTRIBUTION.text}
          </a>
        </p>
      )}
    </div>
  );
}

function Group({
  id,
  title,
  note,
  items,
  emptyText,
}: {
  id: string;
  title: string;
  note?: string;
  items: ClosetCard[];
  // Without it, an empty group is not shown at all.
  emptyText?: string;
}) {
  if (items.length === 0 && !emptyText) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        <span className="text-sm text-foreground/50">
          {note ? `${note} · ` : ""}
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <ItemList items={items} />
      ) : (
        <p className="text-sm text-foreground/60">{emptyText}</p>
      )}
    </section>
  );
}

function ItemList({ items }: { items: ClosetCard[] }) {
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

export function ClosetGridSkeleton() {
  return (
    <ul className={GRID} aria-busy="true" aria-label="Loading your closet">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i}>
          <div className="aspect-[3/4] animate-pulse rounded-xl bg-black/[.06] dark:bg-white/[.08]" />
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        </li>
      ))}
    </ul>
  );
}
