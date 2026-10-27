import { z } from "zod";
import { cookieString, cookieValue } from "../cookie";
import type { WeatherLocation } from "./location";

// Where the weather is for, kept in the browser (never in the database):
// a city picked on the profile page, or the device's own location. Picked
// wins until the user goes back to "Use my location".
export const LOCATION_COOKIE = "fc_location";
// Set once the home page has asked for location permission, so it never
// asks on its own again.
export const GEO_ASKED_COOKIE = "fc_geo_asked";

export const MAX_CITY_LENGTH = 80;

const Lat = z.number().min(-90).max(90);
const Lon = z.number().min(-180).max(180);

export const StoredLocation = z.discriminatedUnion("src", [
  z.object({ src: z.literal("picked"), lat: Lat, lon: Lon, city: z.string().trim().min(1).max(MAX_CITY_LENGTH) }),
  z.object({ src: z.literal("device"), lat: Lat, lon: Lon }),
]);
export type StoredLocation = z.infer<typeof StoredLocation>;

// ~1 km, the same grain as the weather cache. Exact positions never leave
// the browser.
export function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseLocationCookie(raw: string | null): StoredLocation | null {
  if (!raw) return null;
  try {
    const parsed = StoredLocation.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// From a request's Cookie header; anything malformed counts as no cookie.
export function readLocationCookie(headers: Headers): StoredLocation | null {
  return parseLocationCookie(cookieValue(headers.get("cookie"), LOCATION_COOKIE));
}

export function toWeatherLocation(stored: StoredLocation): WeatherLocation {
  return { lat: stored.lat, lon: stored.lon, city: stored.src === "picked" ? stored.city : null };
}

export function locationCookieString(stored: StoredLocation): string {
  const value: StoredLocation =
    stored.src === "picked"
      ? { src: "picked", lat: roundCoord(stored.lat), lon: roundCoord(stored.lon), city: stored.city }
      : { src: "device", lat: roundCoord(stored.lat), lon: roundCoord(stored.lon) };
  return cookieString(LOCATION_COOKIE, JSON.stringify(value));
}

export function clearLocationCookieString(): string {
  return cookieString(LOCATION_COOKIE, "", 0);
}
