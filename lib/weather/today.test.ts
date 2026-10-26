import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_MS, clearWeatherCache, FIXED_WEATHER, todayWeather } from "./today";

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

describe("todayWeather", () => {
  it("returns today's temps for the default city and caches them for an hour", async () => {
    let now = 0;
    const opts = { fetchImpl, now: () => now };
    expect(await todayWeather("u", new Headers(), opts)).toEqual({
      date: "2026-10-26",
      lowF: 40,
      highF: 55,
      city: "Madison",
    });
    now = CACHE_MS - 1;
    await todayWeather("u", new Headers(), opts);
    expect(calls).toBe(1);
    now = CACHE_MS;
    await todayWeather("u", new Headers(), opts);
    expect(calls).toBe(2);
  });

  it("is null when Open-Meteo cannot be reached, and tries again next time", async () => {
    failing = true;
    expect(await todayWeather("u", new Headers(), { fetchImpl })).toBeNull();
    failing = false;
    expect(await todayWeather("u", new Headers(), { fetchImpl })).not.toBeNull();
    expect(calls).toBe(2);
  });

  it("never touches the network in fixed or off mode", async () => {
    vi.stubEnv("WEATHER_MODE", "fixed");
    expect(await todayWeather("u", new Headers(), { fetchImpl })).toEqual(FIXED_WEATHER);
    vi.stubEnv("WEATHER_MODE", "off");
    expect(await todayWeather("u", new Headers(), { fetchImpl })).toBeNull();
    expect(calls).toBe(0);
  });
});
