import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCATION_COOKIE } from "./location-cookie";
import { CACHE_MS, clearWeatherCache, FIXED_NO_LOCATION_HEADER, FIXED_WEATHER, NO_LOCATION, todayWeather } from "./today";

const FORECAST = {
  daily: { time: ["2026-10-26"], temperature_2m_min: [40], temperature_2m_max: [55] },
};

let calls = 0;
let failing = false;
const fetchImpl = (async () => {
  calls++;
  if (failing) throw new Error("offline");
  return new Response(JSON.stringify(FORECAST));
}) as unknown as typeof fetch;

beforeEach(() => {
  calls = 0;
  failing = false;
  clearWeatherCache();
  vi.stubEnv("WEATHER_MODE", "live");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Vercel's IP guess, so live mode has a location to ask about.
const here = () =>
  new Headers({ "x-vercel-ip-latitude": "47.61", "x-vercel-ip-longitude": "-122.33", "x-vercel-ip-city": "Seattle" });

describe("todayWeather", () => {
  it("returns today's temps for the guessed city and caches them for an hour", async () => {
    let now = 0;
    const opts = { fetchImpl, now: () => now };
    expect(await todayWeather("u", here(), opts)).toEqual({
      date: "2026-10-26",
      lowF: 40,
      highF: 55,
      city: "Seattle",
    });
    now = CACHE_MS - 1;
    await todayWeather("u", here(), opts);
    expect(calls).toBe(1);
    now = CACHE_MS;
    await todayWeather("u", here(), opts);
    expect(calls).toBe(2);
  });

  it("says there is no location when none is known, and asks nobody", async () => {
    expect(await todayWeather("u", new Headers(), { fetchImpl })).toBe(NO_LOCATION);
    expect(calls).toBe(0);
  });

  it("is null when Open-Meteo cannot be reached, and tries again next time", async () => {
    failing = true;
    expect(await todayWeather("u", here(), { fetchImpl })).toBeNull();
    failing = false;
    expect(await todayWeather("u", here(), { fetchImpl })).not.toBeNull();
    expect(calls).toBe(2);
  });

  it("never touches the network in fixed or off mode", async () => {
    vi.stubEnv("WEATHER_MODE", "fixed");
    expect(await todayWeather("u", new Headers(), { fetchImpl })).toEqual(FIXED_WEATHER);
    // Tests can ask for the no-location path; a location cookie still wins.
    expect(await todayWeather("u", new Headers({ [FIXED_NO_LOCATION_HEADER]: "1" }), { fetchImpl })).toBe(NO_LOCATION);
    const picked = encodeURIComponent(JSON.stringify({ src: "picked", lat: 41.88, lon: -87.63, city: "Chicago" }));
    expect(
      await todayWeather("u", new Headers({ [FIXED_NO_LOCATION_HEADER]: "1", cookie: `${LOCATION_COOKIE}=${picked}` }), { fetchImpl }),
    ).toEqual({ ...FIXED_WEATHER, city: "Chicago" });
    vi.stubEnv("WEATHER_MODE", "off");
    expect(await todayWeather("u", new Headers(), { fetchImpl })).toBeNull();
    expect(calls).toBe(0);
  });

  it("names fixed weather after the browser's location, temps unchanged", async () => {
    vi.stubEnv("WEATHER_MODE", "fixed");
    const withCookie = (value: unknown) =>
      new Headers({ cookie: `${LOCATION_COOKIE}=${encodeURIComponent(JSON.stringify(value))}` });
    expect(
      await todayWeather("u", withCookie({ src: "picked", lat: 41.88, lon: -87.63, city: "Chicago, Illinois, US" })),
    ).toEqual({ ...FIXED_WEATHER, city: "Chicago, Illinois, US" });
    expect(await todayWeather("u", withCookie({ src: "device", lat: 1, lon: 2 }))).toEqual({
      ...FIXED_WEATHER,
      city: null,
    });
  });

  it("asks Open-Meteo for the cookie's location", async () => {
    const urls: string[] = [];
    const spy = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(FORECAST));
    }) as unknown as typeof fetch;
    const headers = new Headers({
      cookie: `${LOCATION_COOKIE}=${encodeURIComponent(JSON.stringify({ src: "device", lat: 41.88, lon: -87.63 }))}`,
    });
    expect(await todayWeather("u", headers, { fetchImpl: spy })).toMatchObject({ city: null, lowF: 40 });
    expect(urls[0]).toContain("latitude=41.88&longitude=-87.63");
  });
});
