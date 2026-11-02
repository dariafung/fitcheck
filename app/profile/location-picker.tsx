"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { writeCookie } from "@/lib/cookie";
import { GEOCODING_ATTRIBUTION, MAX_QUERY_LENGTH, type CityMatch } from "@/lib/profile/geocode";
import { clearLocationCookieString, locationCookieString } from "@/lib/weather/location-cookie";

type Status = "idle" | "searching" | "locating" | "saved" | "error";

const BUTTON = "btn-secondary";

// Where the weather is for. A picked city lives in the browser's
// fc_location cookie and wins over device location until "Use my location".
export function LocationPicker({ current }: { current: { label: string; picked: boolean } }) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityMatch[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) {
      setResults(null);
      setMessage("Type at least 2 letters.");
      return;
    }
    setStatus("searching");
    setMessage(null);
    const res = await fetch(`/api/cities?q=${encodeURIComponent(query.trim())}`).catch(() => null);
    if (!res?.ok) {
      setStatus("error");
      setResults(null);
      setMessage("Search isn't working right now.");
      return;
    }
    const { cities } = (await res.json()) as { cities: CityMatch[] };
    setStatus("idle");
    setResults(cities);
    if (cities.length === 0) setMessage("No match. Try adding the state or country.");
  }

  function pick(city: CityMatch) {
    writeCookie(locationCookieString({ src: "picked", lat: city.lat, lon: city.lon, city: city.label }));
    close();
    setStatus("saved");
    router.refresh();
  }

  function useMyLocation() {
    setStatus("locating");
    setMessage(null);
    const fallBack = () => {
      writeCookie(clearLocationCookieString());
      setStatus("saved");
      setMessage("Couldn't get your location, so we'll guess.");
      router.refresh();
    };
    if (!("geolocation" in navigator)) return fallBack();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        writeCookie(locationCookieString({ src: "device", lat: pos.coords.latitude, lon: pos.coords.longitude }));
        setStatus("saved");
        router.refresh();
      },
      fallBack,
      { maximumAge: 10 * 60 * 1000, timeout: 10_000 },
    );
  }

  function close() {
    setSearching(false);
    setQuery("");
    setResults(null);
    setMessage(null);
  }

  return (
    <section
      id="weather"
      aria-labelledby="weather-heading"
      className="grid scroll-mt-6 gap-x-4 gap-y-6 border-t border-ink pt-6 md:grid-cols-12"
    >
      <h2 id="weather-heading" className="text-lg font-medium md:col-span-4">
        Weather location
      </h2>
      <div className="flex flex-col gap-4 md:col-span-7 md:col-start-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p data-testid="weather-location" className="text-lg">{current.label}</p>
        {status === "saved" && (
          <p role="status" className="text-sm text-ink-2">
            {message ?? "Saved"}
          </p>
        )}
      </div>

      {searching ? (
        <div className="flex flex-col gap-3">
          <form role="search" onSubmit={search} className="flex flex-wrap items-center gap-2">
            <input
              aria-label="City"
              type="search"
              value={query}
              maxLength={MAX_QUERY_LENGTH}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="City name"
              autoFocus
              className="field w-56"
            />
            <button type="submit" disabled={status === "searching"} className={BUTTON}>
              {status === "searching" ? "Searching…" : "Search"}
            </button>
            <button type="button" onClick={close} className="btn-text ml-2">
              Cancel
            </button>
          </form>
          {results && results.length > 0 && (
            <ul aria-label="Matching cities" className="flex flex-col items-start gap-2">
              {results.map((c) => (
                <li key={c.label}>
                  <button type="button" onClick={() => pick(c)} className="cursor-pointer text-left underline-offset-4 hover:underline">
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {message && (
            <p role={status === "error" ? "alert" : undefined} className="text-sm text-ink-2">
              {message}
            </p>
          )}
          <p className="text-xs text-ink-2">
            <a href={GEOCODING_ATTRIBUTION.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
              {GEOCODING_ATTRIBUTION.text}
            </a>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSearching(true);
              setStatus("idle");
            }}
            className={BUTTON}
          >
            Change
          </button>
          {current.picked && (
            <button type="button" onClick={useMyLocation} disabled={status === "locating"} className={BUTTON}>
              {status === "locating" ? "Finding you…" : "Use my location"}
            </button>
          )}
        </div>
      )}
      </div>
    </section>
  );
}
