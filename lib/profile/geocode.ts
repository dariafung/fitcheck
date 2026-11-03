import { z } from "zod";
import { roundCoord } from "../weather/location-cookie";

// City search for the weather location: Open-Meteo's geocoding API (free,
// no key, same terms as the forecast). Its data comes from GeoNames, which
// the page credits (GEOCODING_ATTRIBUTION).
export const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
export const GEOCODING_ATTRIBUTION = { text: "Location data based on GeoNames", href: "https://www.geonames.org/" };

// Open-Meteo returns nothing for 1 character; 2 match exactly, 3+ by prefix.
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 80;
export const MAX_RESULTS = 5;

const TIMEOUT_MS = 3000;

export interface CityMatch {
  label: string;
  lat: number;
  lon: number;
}

// WEATHER_MODE "fixed" / "off" (automated tests) search these instead of
// the network, by label prefix.
export const FIXED_CITIES: CityMatch[] = [
  { label: "Chicago, Illinois, US", lat: 41.88, lon: -87.63 },
  { label: "Seattle, Washington, US", lat: 47.61, lon: -122.33 },
  { label: "Testville", lat: 40, lon: -100 },
];

const Geocoding = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        admin1: z.string().optional(),
        country_code: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
});

export function geocodingUrl(query: string): string {
  const params = new URLSearchParams({ name: query, count: String(MAX_RESULTS), language: "en", format: "json" });
  return `${GEOCODING_URL}?${params}`;
}

interface Options {
  fetchImpl?: typeof fetch;
}

// Up to MAX_RESULTS cities, labelled "Name, Region, CC" and de-duplicated.
// Too-short queries return [] without asking. Throws when the service fails.
export async function searchCities(query: string, { fetchImpl = fetch }: Options = {}): Promise<CityMatch[]> {
  const q = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length < MIN_QUERY_LENGTH) return [];

  const mode = process.env.WEATHER_MODE || "live";
  if (mode === "fixed" || mode === "off") {
    const prefix = q.toLowerCase();
    return FIXED_CITIES.filter((c) => c.label.toLowerCase().startsWith(prefix));
  }

  const res = await fetchImpl(geocodingUrl(q), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Open-Meteo geocoding answered ${res.status}`);
  const { results = [] } = Geocoding.parse(await res.json());

  const seen = new Set<string>();
  const cities: CityMatch[] = [];
  for (const r of results) {
    const region = r.admin1 && r.admin1 !== r.name ? r.admin1 : undefined;
    const label = [r.name, region, r.country_code ?? r.country].filter(Boolean).join(", ");
    if (seen.has(label)) continue;
    seen.add(label);
    cities.push({ label, lat: roundCoord(r.latitude), lon: roundCoord(r.longitude) });
  }
  return cities.slice(0, MAX_RESULTS);
}
