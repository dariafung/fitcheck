import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { goodForToday } from "@/lib/closet/fit-today";
import { listClosetItems } from "@/lib/closet/items";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { shortCity } from "@/lib/weather/location";
import { ATTRIBUTION } from "@/lib/weather/open-meteo";
import { todayWeather } from "@/lib/weather/today";
import { ClosetGridSkeleton, EmptyCloset, ItemList } from "./closet-grid";
import { LocationSync } from "./location-sync";

// Home's pick from the closet: what suits today's local weather. The location
// comes from the browser (picked city or device location, see LocationSync),
// else the IP guess.
export async function GoodForToday() {
  await connection();
  const userId = await currentUserId();
  const [items, weather] = await Promise.all([
    listClosetItems(createServerClient(), userId),
    headers().then((h) => todayWeather(userId, h)),
  ]);
  const good = goodForToday(items, weather && { min: weather.lowF, max: weather.highF });

  return (
    <Section
      note={weather ? `${weather.city ? shortCity(weather.city) : "Near you"} · ${weather.lowF}–${weather.highF}°F` : undefined}
    >
      <LocationSync />
      {!weather && (
        <p className="text-sm text-foreground/60">
          Couldn&apos;t get today&apos;s weather, so here&apos;s everything.
        </p>
      )}
      {items.length === 0 ? (
        <EmptyCloset />
      ) : good.length > 0 ? (
        <ItemList items={good} />
      ) : (
        <p className="text-sm text-foreground/60">Nothing here fits today&apos;s weather.</p>
      )}
      {weather && (
        <p className="text-xs text-foreground/50">
          <a href={ATTRIBUTION.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {ATTRIBUTION.text}
          </a>
        </p>
      )}
    </Section>
  );
}

export function GoodForTodaySkeleton() {
  return (
    <Section>
      <ClosetGridSkeleton />
    </Section>
  );
}

function Section({ note, children }: { note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="good-for-today" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 id="good-for-today" className="text-lg font-semibold">
            Good for today
          </h2>
          {note && (
            <span className="text-sm text-foreground/50">
              {note} ·{" "}
              <Link
                href="/profile#weather"
                aria-label="Change weather location"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Change
              </Link>
            </span>
          )}
        </div>
        <Link href="/closet" className="shrink-0 text-sm font-medium underline-offset-2 hover:underline">
          See all clothes
        </Link>
      </div>
      {children}
    </section>
  );
}
