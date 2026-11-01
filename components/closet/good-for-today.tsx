import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { goodForToday } from "@/lib/closet/fit-today";
import { listClosetItems } from "@/lib/closet/items";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { tempUnitFor } from "@/lib/profile/temp-setting";
import { toUnit } from "@/lib/profile/temp-unit";
import { shortCity } from "@/lib/weather/location";
import { ATTRIBUTION } from "@/lib/weather/open-meteo";
import { todayWeather } from "@/lib/weather/today";
import { ClosetGridSkeleton, EmptyCloset, ItemList } from "./closet-grid";
import { LocationSync } from "./location-sync";

// Three across next to the style card on a desktop, so each slot lines up
// with the closet's four-across shelf.
const TODAY_GRID = "-mx-2 grid grid-cols-2 gap-x-1 gap-y-10 md:mx-0 md:grid-cols-3 md:gap-x-4";
// A pick, not the whole closet again: two rows each way, the rest under
// "See all clothes". Keeps the style card in reach on a phone.
const TODAY_MAX = 6;
const TODAY_MAX_PHONE = 4;

// Home's pick from the closet: what suits today's local weather. The location
// comes from the browser (picked city or device location, see LocationSync),
// else the IP guess.
export async function GoodForToday() {
  await connection();
  const userId = await currentUserId();
  const [items, weather, unit] = await Promise.all([
    listClosetItems(createServerClient(), userId),
    headers().then((h) => todayWeather(userId, h)),
    tempUnitFor(userId),
  ]);
  const good = goodForToday(items, weather && { min: weather.lowF, max: weather.highF });

  return (
    <Section
      note={
        weather
          ? `${weather.city ? shortCity(weather.city) : "Near you"} · ${toUnit(weather.lowF, unit)}–${toUnit(weather.highF, unit)}°${unit}`
          : undefined
      }
    >
      <LocationSync />
      {!weather && (
        <p className="text-sm text-ink-2">
          Couldn&apos;t get today&apos;s weather, so here&apos;s everything.
        </p>
      )}
      {items.length === 0 ? (
        <EmptyCloset />
      ) : good.length > 0 ? (
        <ItemList items={good.slice(0, TODAY_MAX)} grid={TODAY_GRID} phoneLimit={TODAY_MAX_PHONE} />
      ) : (
        <p className="text-sm text-ink-2">Nothing here fits today&apos;s weather.</p>
      )}
      {weather && (
        <p className="text-xs text-ink-2">
          <a
            href={ATTRIBUTION.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors duration-150 hover:text-ink"
          >
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
      <ClosetGridSkeleton grid={TODAY_GRID} />
    </Section>
  );
}

function Section({ note, children }: { note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="good-for-today" className="flex flex-col gap-6">
      {/* Fixed height: matches the style card's heading bar beside it. */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line pb-3 lg:h-12 lg:flex-nowrap lg:items-end">
          <h2 id="good-for-today" className="text-lg leading-none font-medium">
            Good for today
          </h2>
          {note && (
            <span className="order-last w-full text-sm text-ink-2 md:order-none md:w-auto">
              {note} ·{" "}
              <Link
                href="/profile#weather"
                aria-label="Change weather location"
                className="underline underline-offset-4 transition-colors duration-150 hover:text-ink"
              >
                Change
              </Link>
            </span>
          )}
        <Link
          href="/closet"
          className="ml-auto shrink-0 text-sm underline underline-offset-4 transition-colors duration-150 hover:text-ink-2"
        >
          See all clothes
        </Link>
      </div>
      {children}
    </section>
  );
}
