import { z } from "zod";
import type { WeatherLocation } from "./location";

// Open-Meteo: free, no key, non-commercial use; its license asks for credit
// on the page (see ATTRIBUTION).
export const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
export const ATTRIBUTION = { text: "Weather data by Open-Meteo.com", href: "https://open-meteo.com/" };

const TIMEOUT_MS = 3000;

const Forecast = z.object({
  daily: z.object({
    time: z.array(z.string()).min(1),
    temperature_2m_min: z.array(z.number()).min(1),
    temperature_2m_max: z.array(z.number()).min(1),
  }),
});

export interface TodayTemps {
  // Local date at the location, YYYY-MM-DD.
  date: string;
  lowF: number;
  highF: number;
}

export function forecastUrl({ lat, lon }: Pick<WeatherLocation, "lat" | "lon">): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    daily: "temperature_2m_max,temperature_2m_min",
    temperature_unit: "fahrenheit",
    // "Today" is the location's own day.
    timezone: "auto",
    forecast_days: "1",
  });
  return `${OPEN_METEO_URL}?${params}`;
}

// Today's low and high, rounded to whole degrees. Throws on any failure.
export async function fetchTodayTemps(
  location: Pick<WeatherLocation, "lat" | "lon">,
  fetchImpl: typeof fetch = fetch,
): Promise<TodayTemps> {
  const res = await fetchImpl(forecastUrl(location), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
  const { daily } = Forecast.parse(await res.json());
  return {
    date: daily.time[0],
    lowF: Math.round(daily.temperature_2m_min[0]),
    highF: Math.round(daily.temperature_2m_max[0]),
  };
}
