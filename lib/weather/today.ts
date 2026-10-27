import { resolveLocation } from "./location";
import { readLocationCookie, toWeatherLocation } from "./location-cookie";
import { fetchTodayTemps, type TodayTemps } from "./open-meteo";

export interface TodayWeather extends TodayTemps {
  city: string | null;
}

// WEATHER_MODE: "live" (default) asks Open-Meteo; "fixed" returns
// FIXED_WEATHER's temps (named after the browser's location cookie when there
// is one) and "off" acts as if the weather is unavailable, both without
// touching the network (for automated tests).
export const FIXED_WEATHER: TodayWeather = { date: "2026-10-26", city: "Testville", lowF: 50, highF: 65 };

export const CACHE_MS = 60 * 60 * 1000;

const cache = new Map<string, { at: number; temps: TodayTemps }>();

interface Options {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

// Cached per location (rounded to ~1 km) for an hour, per server instance.
// Returns null when the weather cannot be had; the closet then skips grouping.
export async function todayWeather(
  userId: string,
  headers: Headers,
  { fetchImpl, now = Date.now }: Options = {},
): Promise<TodayWeather | null> {
  const mode = process.env.WEATHER_MODE || "live";
  if (mode === "fixed") {
    const stored = readLocationCookie(headers);
    return stored ? { ...FIXED_WEATHER, city: toWeatherLocation(stored).city } : FIXED_WEATHER;
  }
  if (mode === "off") return null;

  const location = await resolveLocation(userId, headers);
  const key = `${location.lat.toFixed(2)},${location.lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && now() - hit.at < CACHE_MS) return { ...hit.temps, city: location.city };

  try {
    const temps = await fetchTodayTemps(location, fetchImpl);
    cache.set(key, { at: now(), temps });
    return { ...temps, city: location.city };
  } catch {
    return null;
  }
}

export function clearWeatherCache(): void {
  cache.clear();
}
