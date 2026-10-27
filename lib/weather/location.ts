import { readLocationCookie, toWeatherLocation } from "./location-cookie";

export interface WeatherLocation {
  lat: number;
  lon: number;
  city: string | null;
}

// Used when there is no browser location and no IP location (e.g. local dev).
export const DEFAULT_LOCATION: WeatherLocation = { lat: 43.07, lon: -89.4, city: "Madison" };

// Vercel's IP geolocation headers. The city is URL-encoded.
export function locationFromHeaders(headers: Headers): WeatherLocation | null {
  const lat = Number(headers.get("x-vercel-ip-latitude") ?? NaN);
  const lon = Number(headers.get("x-vercel-ip-longitude") ?? NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, city: decodeCity(headers.get("x-vercel-ip-city")) };
}

function decodeCity(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// "Chicago, Illinois, US" → "Chicago", for tight spots like the home page.
export function shortCity(city: string): string {
  return city.split(",")[0].trim() || city;
}

// The browser's location cookie (picked city, then device location) wins
// over the IP guess. userId is unused while location lives in the browser.
export async function resolveLocation(userId: string, headers: Headers): Promise<WeatherLocation> {
  void userId;
  const stored = readLocationCookie(headers);
  return (stored && toWeatherLocation(stored)) ?? locationFromHeaders(headers) ?? DEFAULT_LOCATION;
}

// How the profile page describes where the weather is for.
export function describeLocation(headers: Headers): { label: string; picked: boolean } {
  const stored = readLocationCookie(headers);
  if (stored?.src === "picked") return { label: stored.city, picked: true };
  if (stored) return { label: "Your location", picked: false };
  const ip = locationFromHeaders(headers);
  if (ip) return { label: `${ip.city ?? "Near you"} (best guess)`, picked: false };
  return { label: `${DEFAULT_LOCATION.city} (default)`, picked: false };
}
