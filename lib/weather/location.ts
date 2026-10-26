export interface WeatherLocation {
  lat: number;
  lon: number;
  city: string | null;
}

// Used when there is no user-set city and no IP location (e.g. local dev).
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

// The city the user picked on the profile page wins over the IP guess.
// Profile has no city yet (next closet feature), so this is always null.
export async function userLocation(userId: string): Promise<WeatherLocation | null> {
  void userId;
  return null;
}

export async function resolveLocation(userId: string, headers: Headers): Promise<WeatherLocation> {
  return (await userLocation(userId)) ?? locationFromHeaders(headers) ?? DEFAULT_LOCATION;
}
